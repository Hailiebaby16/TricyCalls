import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  MD3LightTheme,
  PaperProvider,
  Surface,
  Text
} from 'react-native-paper';
import {
  acceptRide,
  apiUrl,
  getDriverQueue,
  leaveQueue,
  listRides,
  registerPushToken,
  rejectRide,
  updateDriverLocation,
  updateRideStatus
} from './src/api';
import type { QueueStatus, Ride, RideStatus } from './src/types';

const driverId = 'driver-1';
const fallbackLocation = { lat: 16.70055, lng: 121.67595 };
const activeStatuses: RideStatus[] = ['OFFERED', 'ASSIGNED', 'PICKED_UP'];

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#B42318',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FEE4E2',
    onPrimaryContainer: '#7A271A',
    background: '#FFF7F7',
    surface: '#FFFFFF',
    surfaceVariant: '#FFF1F0',
    outline: '#E4B1AA'
  }
};

export default function App() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const load = useCallback(async (refreshing = false) => {
    refreshing ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const [nextRides, nextQueue] = await Promise.all([listRides(), getDriverQueue(driverId)]);
      setRides(nextRides);
      setQueueStatus(nextQueue);
    } catch (error) {
      Alert.alert('Backend offline', `${error instanceof Error ? error.message : 'Unable to load rider data'}\n\nAPI: ${apiUrl}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void registerForPush();
  }, [load]);

  useEffect(() => {
    const socketUrl = apiUrl.replace(/^http/, 'ws');
    const socket = new WebSocket(`${socketUrl}/api/socket?role=driver&driverId=${driverId}`);
    socketRef.current = socket;

    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === 'ride.offered') {
          setRides(current => [message.payload, ...current.filter(ride => ride.id !== message.payload.id)]);
        }
      } catch {
        // Ignore malformed socket messages from development reloads.
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const driverRides = useMemo(
    () => rides.filter(ride => ride.driver?.id === driverId && activeStatuses.includes(ride.status)),
    [rides]
  );
  const offeredRide = driverRides.find(ride => ride.status === 'OFFERED' && ride.offer?.driverId === driverId);
  const activeRide = driverRides.find(ride => ride.status !== 'OFFERED');

  async function registerForPush() {
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        return;
      }
      const token = await Notifications.getExpoPushTokenAsync();
      await registerPushToken(driverId, token.data);
    } catch {
      // Push is optional in local Expo development.
    }
  }

  async function joinQueue() {
    setIsLocating(true);
    try {
      const location = await getCurrentLocation();
      const nextQueue = await updateDriverLocation(driverId, { ...location, joinQueue: true });
      setQueueStatus(nextQueue);
      await load(true);
    } catch (error) {
      Alert.alert('Queue update failed', error instanceof Error ? error.message : 'Could not update queue');
    } finally {
      setIsLocating(false);
    }
  }

  async function refreshLocation() {
    setIsLocating(true);
    try {
      const location = await getCurrentLocation();
      setQueueStatus(await updateDriverLocation(driverId, { ...location, joinQueue: false }));
    } catch (error) {
      Alert.alert('Location failed', error instanceof Error ? error.message : 'Could not refresh location');
    } finally {
      setIsLocating(false);
    }
  }

  async function manuallyLeaveQueue() {
    setQueueStatus(await leaveQueue(driverId));
    await load(true);
  }

  async function setRideStatus(ride: Ride, action: 'accept' | 'reject' | 'picked_up' | 'complete') {
    setPendingRideId(ride.id);
    try {
      if (action === 'accept') {
        await acceptRide(ride.id, driverId);
      } else if (action === 'reject') {
        await rejectRide(ride.id, driverId);
      } else if (action === 'picked_up') {
        await updateRideStatus(ride.id, 'PICKED_UP');
      } else {
        await updateRideStatus(ride.id, 'COMPLETED');
      }
      await load(true);
    } catch (error) {
      Alert.alert('Ride update failed', error instanceof Error ? error.message : 'Could not update ride');
    } finally {
      setPendingRideId(null);
    }
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.hero}>
          <View>
            <Text variant="headlineLarge" style={styles.heroTitle}>Rider</Text>
            <Text variant="bodyLarge" style={styles.heroSubtitle}>TODA priority console</Text>
          </View>
          <Chip icon="access-point" style={styles.readyChip} textStyle={styles.readyText}>Socket</Chip>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
        >
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading TODA queue</Text>
            </View>
          ) : (
            <>
              <QueuePanel
                queueStatus={queueStatus}
                isLocating={isLocating}
                onJoin={() => void joinQueue()}
                onRefreshLocation={() => void refreshLocation()}
                onLeave={() => void manuallyLeaveQueue()}
              />

              {offeredRide ? (
                <OfferCard
                  ride={offeredRide}
                  isPending={pendingRideId === offeredRide.id}
                  onAccept={() => void setRideStatus(offeredRide, 'accept')}
                  onReject={() => void setRideStatus(offeredRide, 'reject')}
                />
              ) : null}

              <Text variant="titleLarge" style={styles.sectionTitle}>Active Trip</Text>
              {activeRide ? (
                <RideCard
                  ride={activeRide}
                  isPending={pendingRideId === activeRide.id}
                  onPickedUp={() => void setRideStatus(activeRide, 'picked_up')}
                  onCompleted={() => void setRideStatus(activeRide, 'complete')}
                />
              ) : (
                <EmptyState title="No active trip" body="Enter TODA Queue Zone to get priority bookings." />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
}

function QueuePanel({
  queueStatus,
  isLocating,
  onJoin,
  onRefreshLocation,
  onLeave
}: {
  queueStatus: QueueStatus | null;
  isLocating: boolean;
  onJoin: () => void;
  onRefreshLocation: () => void;
  onLeave: () => void;
}) {
  const statusText = queueStatus?.status === 'waiting'
    ? `In queue #${queueStatus.queuePosition}`
    : queueStatus?.insideQueueZone
      ? 'Inside queue zone'
      : 'Outside zone';

  return (
    <Surface style={styles.panel} elevation={0}>
      <View style={styles.cardHeader}>
        <View>
          <Text variant="labelLarge" style={styles.eyebrow}>MY TODA</Text>
          <Text variant="titleLarge" style={styles.panelTitle}>{queueStatus?.toda?.name ?? 'No TODA assigned'}</Text>
        </View>
        <Chip style={styles.statusChip} textStyle={styles.statusText}>{statusText}</Chip>
      </View>
      <Text style={styles.muted}>Enter TODA Queue Zone to get priority bookings. Press Join Queue only when you are physically in the queue area.</Text>
      <View style={styles.actions}>
        <Button mode="contained" icon="map-marker-check" loading={isLocating} onPress={onJoin}>Join Queue</Button>
        <Button mode="outlined" icon="crosshairs-gps" loading={isLocating} onPress={onRefreshLocation}>Refresh GPS</Button>
        <Button mode="text" disabled={queueStatus?.status !== 'waiting'} onPress={onLeave}>Leave</Button>
      </View>
    </Surface>
  );
}

function OfferCard({
  ride,
  isPending,
  onAccept,
  onReject
}: {
  ride: Ride;
  isPending: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <Card mode="contained" style={styles.offerCard}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View>
            <Text variant="labelLarge" style={styles.eyebrow}>NEW BOOKING</Text>
            <Text variant="titleLarge" style={styles.panelTitle}>{ride.passengerName}</Text>
          </View>
          <Chip style={styles.fareChip} textStyle={styles.fareText}>PHP {ride.fare}</Chip>
        </View>
        <RouteLine pickup={ride.pickup.name} dropoff={ride.dropoff.name} />
        <Text style={styles.muted}>Expires {ride.offer ? new Date(ride.offer.expiresAt).toLocaleTimeString() : 'soon'}</Text>
        <View style={styles.actions}>
          <Button mode="contained" loading={isPending} onPress={onAccept}>Accept</Button>
          <Button mode="outlined" disabled={isPending} onPress={onReject}>Reject</Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function RideCard({
  ride,
  isPending,
  onPickedUp,
  onCompleted
}: {
  ride: Ride;
  isPending: boolean;
  onPickedUp: () => void;
  onCompleted: () => void;
}) {
  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleLarge" style={styles.panelTitle}>{ride.passengerName}</Text>
          <Chip style={styles.fareChip} textStyle={styles.fareText}>{ride.status}</Chip>
        </View>
        <RouteLine pickup={ride.pickup.name} dropoff={ride.dropoff.name} />
        <Divider style={styles.divider} />
        <View style={styles.actions}>
          <Button mode="contained" disabled={ride.status !== 'ASSIGNED' || isPending} onPress={onPickedUp}>Picked up</Button>
          <Button mode="contained-tonal" disabled={ride.status !== 'PICKED_UP' || isPending} onPress={onCompleted}>Complete</Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function RouteLine({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <View style={styles.route}>
      <View style={styles.routeRail}>
        <View style={styles.dot} />
        <View style={styles.rail} />
        <View style={styles.square} />
      </View>
      <View style={styles.routeText}>
        <Text variant="titleMedium" style={styles.routePlace}>{pickup}</Text>
        <Text style={styles.arrow}>to</Text>
        <Text variant="titleMedium" style={styles.routePlace}>{dropoff}</Text>
      </View>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Surface style={styles.empty} elevation={0}>
      <MaterialCommunityIcons name="map-marker-distance" size={24} color="#B42318" />
      <Text variant="titleMedium">{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </Surface>
  );
}

async function getCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return fallbackLocation;
  }
  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: current.coords.latitude, lng: current.coords.longitude };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF7F7' },
  hero: {
    backgroundColor: '#B42318',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16
  },
  heroTitle: { color: '#FFFFFF', fontWeight: '800' },
  heroSubtitle: { color: '#FEE4E2', marginTop: 2 },
  readyChip: { backgroundColor: '#FFFFFF' },
  readyText: { color: '#B42318', fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  panel: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#F2B8B5',
    borderWidth: 1,
    padding: 16,
    gap: 14
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderColor: '#F2B8B5',
    borderWidth: 1
  },
  offerCard: {
    backgroundColor: '#FFF1F0',
    borderRadius: 8,
    borderColor: '#D92D20',
    borderWidth: 1
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  eyebrow: { color: '#B42318', fontWeight: '800' },
  panelTitle: { color: '#111827', fontWeight: '800', flexShrink: 1 },
  sectionTitle: { color: '#1D2939', fontWeight: '800', marginTop: 4 },
  statusChip: { backgroundColor: '#FEE4E2' },
  statusText: { color: '#7A271A', fontWeight: '800' },
  fareChip: { backgroundColor: '#FFFFFF' },
  fareText: { color: '#B42318', fontWeight: '800' },
  muted: { color: '#667085' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  route: { flexDirection: 'row', gap: 12, marginTop: 18 },
  routeRail: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D92D20' },
  rail: { width: 2, height: 30, backgroundColor: '#FDA29B', marginVertical: 4 },
  square: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#7A271A' },
  routeText: { flex: 1, gap: 2 },
  routePlace: { color: '#1D2939', fontWeight: '700' },
  arrow: { color: '#98A2B3' },
  divider: { marginVertical: 16, backgroundColor: '#F2B8B5' },
  empty: {
    borderRadius: 8,
    borderColor: '#F2B8B5',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 6
  }
});
