import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  Text,
  TextInput
} from 'react-native-paper';
import { WebView } from 'react-native-webview';
import {
  apiUrl,
  assignDriverToToda,
  getTodaQueue,
  listDrivers,
  listRides,
  listTodas,
  removeDriverFromToda,
  updateRideStatus,
  updateToda
} from './src/api';
import type { Driver, Ride, RideStatus, Toda, TodaQueueRecord } from './src/types';

const activeStatuses: RideStatus[] = ['REQUESTED', 'OFFERED', 'ASSIGNED', 'PICKED_UP'];
const echagueCenter = { lat: 16.7025, lng: 121.67833 };

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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [todas, setTodas] = useState<Toda[]>([]);
  const [selectedTodaId, setSelectedTodaId] = useState<string | null>(null);
  const [queue, setQueue] = useState<TodaQueueRecord[]>([]);
  const [draft, setDraft] = useState<Toda | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const selectedToda = todas.find(toda => toda.id === selectedTodaId) ?? todas[0] ?? null;

  const load = useCallback(async (refreshing = false) => {
    refreshing ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const [nextRides, nextDrivers, nextTodas] = await Promise.all([listRides(), listDrivers(), listTodas()]);
      setRides(nextRides);
      setDrivers(nextDrivers);
      setTodas(nextTodas);
      const nextSelected = selectedTodaId ?? nextTodas[0]?.id ?? null;
      setSelectedTodaId(nextSelected);
      if (nextSelected) {
        const nextQueue = await getTodaQueue(nextSelected);
        setQueue(nextQueue);
        setDraft(nextTodas.find(toda => toda.id === nextSelected) ?? null);
      }
    } catch (error) {
      Alert.alert('Backend offline', `${error instanceof Error ? error.message : 'Unable to load admin data'}\n\nAPI: ${apiUrl}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTodaId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const socketUrl = apiUrl.replace(/^http/, 'ws');
    const socket = new WebSocket(`${socketUrl}/api/socket?role=admin`);
    socketRef.current = socket;
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.event.startsWith('ride.') || message.event === 'queue.updated') {
          void load(true);
        }
      } catch {
        // Ignore stale development socket frames.
      }
    };
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [load]);

  const metrics = useMemo(() => {
    const active = rides.filter(ride => activeStatuses.includes(ride.status));
    const revenue = rides.filter(ride => ride.status === 'COMPLETED').reduce((sum, ride) => sum + ride.fare, 0);
    return {
      active: active.length,
      revenue,
      queued: queue.length,
      total: rides.length
    };
  }, [queue.length, rides]);

  async function saveToda() {
    if (!draft) {
      return;
    }
    setIsSaving(true);
    try {
      const saved = await updateToda(draft.id, draft);
      setTodas(current => current.map(toda => (toda.id === saved.id ? saved : toda)));
      setDraft(saved);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save TODA');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleDriver(driver: Driver) {
    if (!draft) {
      return;
    }
    const assigned = draft.assignedDriverIds.includes(driver.id);
    const saved = assigned
      ? await removeDriverFromToda(draft.id, driver.id)
      : await assignDriverToToda(draft.id, driver.id);
    setDraft(saved);
    setTodas(current => current.map(toda => (toda.id === saved.id ? saved : toda)));
  }

  async function setRideStatus(ride: Ride, status: RideStatus) {
    setPendingRideId(ride.id);
    try {
      await updateRideStatus(ride.id, status);
      await load(true);
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Could not update ride');
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
            <Text variant="headlineLarge" style={styles.heroTitle}>Admin</Text>
            <Text variant="bodyLarge" style={styles.heroSubtitle}>TODA dispatch control</Text>
          </View>
          <Chip icon="access-point" style={styles.readyChip} textStyle={styles.readyText}>Live</Chip>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
        >
          <MetricRow metrics={metrics} />

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading dispatch board</Text>
            </View>
          ) : (
            <>
              {draft ? (
                <TodaEditor
                  draft={draft}
                  drivers={drivers}
                  queue={queue}
                  isSaving={isSaving}
                  onChange={setDraft}
                  onSave={() => void saveToda()}
                  onToggleDriver={driver => void toggleDriver(driver)}
                />
              ) : (
                <Surface style={styles.empty} elevation={0}>
                  <Text variant="titleMedium">No TODA found</Text>
                  <Text style={styles.muted}>Create a TODA through the API, then it will appear here.</Text>
                </Surface>
              )}

              <Text variant="titleLarge" style={styles.sectionTitle}>Ride Board</Text>
              {rides.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  isPending={pendingRideId === ride.id}
                  onCancel={() => void setRideStatus(ride, 'CANCELLED')}
                  onComplete={() => void setRideStatus(ride, 'COMPLETED')}
                />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
}

function MetricRow({ metrics }: { metrics: { active: number; revenue: number; queued: number; total: number } }) {
  return (
    <View style={styles.metricsGrid}>
      <Metric icon="map-marker-path" label="Active" value={String(metrics.active)} />
      <Metric icon="account-clock" label="Queued" value={String(metrics.queued)} />
      <Metric icon="cash-multiple" label="Revenue" value={`PHP ${metrics.revenue}`} />
      <Metric icon="clipboard-list" label="Total" value={String(metrics.total)} />
    </View>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <Surface style={styles.metric} elevation={0}>
      <MaterialCommunityIcons name={icon} size={24} color="#B42318" />
      <Text variant="titleLarge" style={styles.metricValue}>{value}</Text>
      <Text variant="labelMedium" style={styles.metricLabel}>{label}</Text>
    </Surface>
  );
}

function TodaEditor({
  draft,
  drivers,
  queue,
  isSaving,
  onChange,
  onSave,
  onToggleDriver
}: {
  draft: Toda;
  drivers: Driver[];
  queue: TodaQueueRecord[];
  isSaving: boolean;
  onChange: (toda: Toda) => void;
  onSave: () => void;
  onToggleDriver: (driver: Driver) => void;
}) {
  return (
    <Surface style={styles.panel} elevation={0}>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text variant="labelLarge" style={styles.eyebrow}>TODA MANAGEMENT</Text>
          <TextInput
            mode="outlined"
            label="TODA name"
            value={draft.name}
            onChangeText={name => onChange({ ...draft, name })}
            style={styles.input}
          />
        </View>
        <Button mode="contained" loading={isSaving} onPress={onSave}>Save</Button>
      </View>

      <TextInput
        mode="outlined"
        label="Description"
        value={draft.description}
        onChangeText={description => onChange({ ...draft, description })}
        multiline
      />

      <ZoneMap draft={draft} onChange={onChange} />

      <View style={styles.radiusRow}>
        <TextInput
          mode="outlined"
          label="Terminal radius"
          value={String(draft.terminalZone.radiusMeters)}
          keyboardType="numeric"
          onChangeText={value => onChange({ ...draft, terminalZone: { ...draft.terminalZone, radiusMeters: Number(value) || 0 } })}
          style={styles.radiusInput}
        />
        <TextInput
          mode="outlined"
          label="Queue radius"
          value={String(draft.queueZone.radiusMeters)}
          keyboardType="numeric"
          onChangeText={value => onChange({ ...draft, queueZone: { ...draft.queueZone, radiusMeters: Number(value) || 0 } })}
          style={styles.radiusInput}
        />
      </View>

      <Text variant="titleMedium" style={styles.subsection}>Assigned Drivers</Text>
      <View style={styles.driverChips}>
        {drivers.map(driver => {
          const selected = draft.assignedDriverIds.includes(driver.id);
          return (
            <Chip
              key={driver.id}
              selected={selected}
              icon={selected ? 'check' : 'plus'}
              onPress={() => onToggleDriver(driver)}
              style={selected ? styles.selectedChip : styles.neutralChip}
            >
              {driver.name}
            </Chip>
          );
        })}
      </View>

      <Text variant="titleMedium" style={styles.subsection}>Live Queue</Text>
      {queue.length === 0 ? (
        <Text style={styles.muted}>No drivers currently waiting.</Text>
      ) : (
        queue.map((record, index) => (
          <View key={record.id} style={styles.queueRow}>
            <Text style={styles.queueNumber}>#{index + 1}</Text>
            <View style={styles.flex}>
              <Text variant="titleMedium" style={styles.driverName}>{record.driver?.name ?? record.driverId}</Text>
              <Text style={styles.muted}>Entered {new Date(record.enteredAt).toLocaleTimeString()}</Text>
            </View>
          </View>
        ))
      )}
    </Surface>
  );
}

function ZoneMap({ draft, onChange }: { draft: Toda; onChange: (toda: Toda) => void }) {
  const html = useMemo(() => buildMapHtml(draft), [draft]);

  return (
    <View style={styles.mapFrame}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={event => {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === 'polygon') {
            onChange({ ...draft, serviceZone: { type: 'Polygon', coordinates: [message.coordinates] } });
          }
          if (message.type === 'terminal') {
            onChange({
              ...draft,
              terminalZone: {
                ...draft.terminalZone,
                center: { type: 'Point', coordinates: [message.lng, message.lat] }
              }
            });
          }
          if (message.type === 'queue') {
            onChange({
              ...draft,
              queueZone: {
                ...draft.queueZone,
                center: { type: 'Point', coordinates: [message.lng, message.lat] }
              }
            });
          }
        }}
      />
    </View>
  );
}

function RideCard({
  ride,
  isPending,
  onCancel,
  onComplete
}: {
  ride: Ride;
  isPending: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const closed = ride.status === 'COMPLETED' || ride.status === 'CANCELLED';
  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <Text variant="labelLarge" style={styles.eyebrow}>{ride.status}</Text>
            <Text variant="titleLarge" style={styles.panelTitle}>{ride.passengerName}</Text>
            <Text style={styles.muted}>{ride.pickup.name} to {ride.dropoff.name}</Text>
          </View>
          <Chip style={styles.fareChip} textStyle={styles.fareText}>PHP {ride.fare}</Chip>
        </View>
        <Divider style={styles.divider} />
        <Text style={styles.muted}>Driver: {ride.driver?.name ?? 'Waiting'} • Source: {ride.dispatchSource ?? 'n/a'}</Text>
        <View style={styles.actions}>
          <Button mode="contained-tonal" disabled={closed || isPending} onPress={onComplete}>Complete</Button>
          <Button mode="outlined" disabled={closed || isPending} onPress={onCancel}>Cancel</Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function buildMapHtml(toda: Toda) {
  const terminal = toLatLng(toda.terminalZone.center.coordinates);
  const queue = toLatLng(toda.queueZone.center.coordinates);
  const polygon = toda.serviceZone.coordinates[0] ?? [];
  const center = polygon[0] ? { lat: polygon[0][1], lng: polygon[0][0] } : echagueCenter;

  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
    .toolbar { position: absolute; z-index: 999; top: 10px; left: 10px; right: 10px; display: flex; gap: 6px; }
    button { border: 0; border-radius: 8px; padding: 8px 10px; background: #fff; color: #991B1B; font-weight: 700; box-shadow: 0 1px 5px rgba(0,0,0,.25); }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="mode='polygon'">Draw service</button>
    <button onclick="mode='terminal'">Set terminal</button>
    <button onclick="mode='queue'">Set queue</button>
    <button onclick="clearPolygon()">Clear</button>
  </div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let mode = 'polygon';
    let points = ${JSON.stringify(polygon)};
    const map = L.map('map').setView([${center.lat}, ${center.lng}], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap' }).addTo(map);
    let polygonLayer = null;
    let terminal = L.circle([${terminal.lat}, ${terminal.lng}], { radius: ${toda.terminalZone.radiusMeters}, color: '#B42318' }).addTo(map);
    let queue = L.circle([${queue.lat}, ${queue.lng}], { radius: ${toda.queueZone.radiusMeters}, color: '#1570EF' }).addTo(map);
    function redraw() {
      if (polygonLayer) map.removeLayer(polygonLayer);
      if (points.length > 0) polygonLayer = L.polygon(points.map(p => [p[1], p[0]]), { color: '#B42318' }).addTo(map);
    }
    function post(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    function clearPolygon() {
      points = [];
      redraw();
      post({ type: 'polygon', coordinates: points });
    }
    map.on('click', e => {
      if (mode === 'polygon') {
        points.push([e.latlng.lng, e.latlng.lat]);
        if (points.length > 2) {
          const first = points[0];
          const closed = [...points, first];
          redraw();
          post({ type: 'polygon', coordinates: closed });
        } else {
          redraw();
        }
      }
      if (mode === 'terminal') {
        terminal.setLatLng(e.latlng);
        post({ type: 'terminal', lat: e.latlng.lat, lng: e.latlng.lng });
      }
      if (mode === 'queue') {
        queue.setLatLng(e.latlng);
        post({ type: 'queue', lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });
    redraw();
  </script>
</body>
</html>`;
}

function toLatLng(coordinates: [number, number]) {
  return { lng: coordinates[0], lat: coordinates[1] };
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    width: '48.5%',
    minHeight: 112,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#F2B8B5',
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between'
  },
  metricValue: { color: '#1D2939', fontWeight: '800' },
  metricLabel: { color: '#667085' },
  panel: { borderRadius: 8, backgroundColor: '#FFFFFF', borderColor: '#F2B8B5', borderWidth: 1, padding: 16, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, borderColor: '#F2B8B5', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
  eyebrow: { color: '#B42318', fontWeight: '800' },
  panelTitle: { color: '#111827', fontWeight: '800' },
  sectionTitle: { color: '#1D2939', fontWeight: '800', marginTop: 4 },
  input: { marginTop: 6 },
  mapFrame: { height: 320, borderRadius: 8, overflow: 'hidden', borderColor: '#F2B8B5', borderWidth: 1 },
  radiusRow: { flexDirection: 'row', gap: 10 },
  radiusInput: { flex: 1 },
  subsection: { color: '#1D2939', fontWeight: '800', marginTop: 4 },
  driverChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedChip: { backgroundColor: '#FEE4E2' },
  neutralChip: { backgroundColor: '#F8FAFC' },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  queueNumber: { color: '#B42318', fontWeight: '800', width: 34 },
  driverName: { color: '#1D2939', fontWeight: '800' },
  fareChip: { backgroundColor: '#FEE4E2' },
  fareText: { color: '#B42318', fontWeight: '800' },
  divider: { marginVertical: 12, backgroundColor: '#F2B8B5' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  empty: { borderRadius: 8, borderColor: '#F2B8B5', borderWidth: 1, backgroundColor: '#FFFFFF', padding: 18, gap: 6 },
  muted: { color: '#667085' }
});
