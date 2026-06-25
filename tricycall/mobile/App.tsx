import { createElement, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator as PaperActivityIndicator,
  Button as PaperButton,
  Card,
  Chip,
  MD3LightTheme,
  PaperProvider,
  TextInput as PaperTextInput
} from 'react-native-paper';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { apiUrl, createRide, estimateFare } from './src/api/client';
import { locations, nearbyDrivers, recentRides } from './src/data/mockData';
import type { FareEstimate, LocationPoint, Ride } from './src/types';

type Tab = 'book' | 'rides';
type RouteField = 'pickup' | 'dropoff';
type PinDirection = 'north' | 'south' | 'east' | 'west';
type PendingPin = {
  field: RouteField;
  location: LocationPoint;
};
const PIN_STEP_DEGREES = 0.00025;
const colors = {
  background: '#FFF7F7',
  surface: '#FFFFFF',
  surfaceAlt: '#FDECEC',
  surfaceTint: '#FFFAFA',
  border: '#F0CACA',
  borderStrong: '#D99A9A',
  text: '#201314',
  muted: '#746061',
  primary: '#B42318',
  primarySoft: '#FEE4E2',
  accent: '#B42318',
  accentText: '#FFFFFF',
  success: '#C92A2A',
  successSoft: '#FFF1F1',
  danger: '#7A1510',
  dangerSoft: '#FFE4E1',
  warning: '#9F1D16',
  mapCanvas: '#F8E7E5',
  onPrimary: '#FFFFFF',
  white: '#FFFFFF'
};
const paperTheme = {
  ...MD3LightTheme,
  roundness: 2,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    secondary: colors.accent,
    tertiary: colors.success,
    primaryContainer: colors.primarySoft,
    secondaryContainer: colors.primarySoft,
    onPrimaryContainer: colors.primary,
    onSecondaryContainer: colors.primary,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceAlt,
    onSurface: colors.text,
    onSurfaceVariant: colors.muted,
    outline: colors.borderStrong,
    error: colors.danger
  }
};

export default function App() {
  const [tab, setTab] = useState<Tab>('book');
  const [pickup, setPickup] = useState<LocationPoint>(locations[0]);
  const [dropoff, setDropoff] = useState<LocationPoint>(locations[1]);
  const [passengerName, setPassengerName] = useState('Guest Passenger');
  const [notes, setNotes] = useState('');
  const [fare, setFare] = useState<FareEstimate | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'ok' | 'offline'>('idle');
  const [activeRouteField, setActiveRouteField] = useState<RouteField>('dropoff');
  const [locationQuery, setLocationQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);

  const rideHistory = useMemo(() => {
    return activeRide ? [activeRide, ...recentRides] : recentRides;
  }, [activeRide]);

  const matchingLocations = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    const filtered = query
      ? locations.filter(location => location.name.toLowerCase().includes(query))
      : locations;

    return filtered.filter(location => {
      if (activeRouteField === 'pickup') {
        return location.id !== dropoff.id;
      }
      return location.id !== pickup.id;
    });
  }, [activeRouteField, dropoff.id, locationQuery, pickup.id]);

  function handleSelectLocation(location: LocationPoint) {
    if (activeRouteField === 'pickup') {
      setPickup(location);
    } else {
      setDropoff(location);
    }
    setFare(null);
    setPendingPin(null);
    setLocationQuery('');
  }

  function handleSwapRoute() {
    setPickup(dropoff);
    setDropoff(pickup);
    setFare(null);
    setPendingPin(null);
    setActiveRouteField(activeRouteField === 'pickup' ? 'dropoff' : 'pickup');
  }

  async function handleUseCurrentLocation() {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to set your pickup from GPS.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      const currentLocation = createPinnedLocation({
        field: 'pickup',
        name: 'My current location',
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });

      setPickup(currentLocation);
      setActiveRouteField('dropoff');
      setFare(null);
      setPendingPin(null);
    } catch {
      Alert.alert('Could not get location', 'Check location services and try again.');
    } finally {
      setIsLocating(false);
    }
  }

  function handleNudgePin(direction: PinDirection) {
    const selected = activeRouteField === 'pickup' ? pickup : dropoff;
    const nudged = nudgeLocation(selected, activeRouteField, direction);

    if (activeRouteField === 'pickup') {
      setPickup(nudged);
    } else {
      setDropoff(nudged);
    }
    setFare(null);
    setPendingPin(null);
  }

  function handleMapTap(location: LocationPoint) {
    setPendingPin({
      field: activeRouteField,
      location
    });
  }

  function handleConfirmPendingPin() {
    if (!pendingPin) {
      return;
    }

    if (pendingPin.field === 'pickup') {
      setPickup(pendingPin.location);
      setActiveRouteField('dropoff');
    } else {
      setDropoff(pendingPin.location);
    }
    setPendingPin(null);
    setFare(null);
  }

  async function handleEstimate() {
    setIsLoading(true);
    try {
      const nextFare = await estimateFare({ pickup, dropoff });
      setFare(nextFare);
      setApiStatus('ok');
    } catch {
      setApiStatus('offline');
      const fallback: FareEstimate = {
        currency: 'PHP',
        fare: 42,
        distanceKm: 1.1,
        etaMinutes: 7,
        durationMinutes: 7,
        source: 'LOCAL_ESTIMATE',
        routeCoordinates: []
      };
      setFare(fallback);
      Alert.alert(
        'Backend offline',
        `Showing a local estimate. Start the backend and make sure Expo can reach ${apiUrl}.`
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBookRide() {
    setIsLoading(true);
    try {
      const ride = await createRide({
        passengerName,
        pickup,
        dropoff,
        notes
      });
      setActiveRide(ride);
      setFare({
        currency: ride.currency,
        fare: ride.fare,
        distanceKm: ride.distanceKm,
        etaMinutes: ride.etaMinutes,
        durationMinutes: ride.durationMinutes,
        source: ride.fareSource,
        routeCoordinates: ride.routeCoordinates
      });
      setApiStatus('ok');
      setTab('rides');
    } catch {
      setApiStatus('offline');
      Alert.alert('Could not book ride', `Start the backend and make sure Expo can reach ${apiUrl}.`);
    } finally {
      setIsLoading(false);
    }
  }

  const canBook = pickup.id !== dropoff.id && !isLoading;

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaView style={styles.shell}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.brand}>Tricycall</Text>
          <Text style={styles.subtitle}>Barangay tricycle rides, dispatched fast.</Text>
        </View>
        <Chip
          compact
          icon={apiStatus === 'offline' ? 'cloud-off-outline' : 'check-circle-outline'}
          mode="flat"
          style={[styles.statusPill, apiStatus === 'offline' && styles.statusPillOffline]}
          textStyle={styles.statusText}
        >
          {apiStatus === 'offline' ? 'Offline' : 'Ready'}
        </Chip>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'book' ? (
          <>
            <MapPanel
              pickup={pickup}
              dropoff={dropoff}
              fare={fare}
              activeField={activeRouteField}
              pendingPin={pendingPin}
              onMapTap={handleMapTap}
            />
            {pendingPin ? (
              <PendingPinPanel
                pendingPin={pendingPin}
                onCancel={() => setPendingPin(null)}
                onConfirm={handleConfirmPendingPin}
              />
            ) : null}

            <RouteSelector
              pickup={pickup}
              dropoff={dropoff}
              activeField={activeRouteField}
              query={locationQuery}
              suggestions={matchingLocations}
              onActiveFieldChange={setActiveRouteField}
              onQueryChange={setLocationQuery}
              onSelectLocation={handleSelectLocation}
              onSwap={handleSwapRoute}
              onUseCurrentLocation={handleUseCurrentLocation}
              onNudgePin={handleNudgePin}
              isLocating={isLocating}
            />

            <View style={styles.formRow}>
              <View style={styles.inputGroup}>
                <PaperTextInput
                  value={passengerName}
                  onChangeText={setPassengerName}
                  label="Passenger"
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.paperInputOutline}
                />
              </View>
              <View style={styles.inputGroup}>
                <PaperTextInput
                  value={notes}
                  onChangeText={setNotes}
                  label="Notes"
                  mode="outlined"
                  style={styles.input}
                  outlineStyle={styles.paperInputOutline}
                />
              </View>
            </View>

            <FarePanel fare={fare} isLoading={isLoading} />

            <View style={styles.actions}>
              <PaperButton
                mode="outlined"
                icon="calculator"
                onPress={handleEstimate}
                disabled={isLoading}
                style={styles.secondaryButton}
                labelStyle={styles.secondaryButtonText}
                textColor={colors.primary}
              >
                Estimate fare
              </PaperButton>
              <PaperButton
                mode="contained"
                icon="rickshaw"
                loading={isLoading}
                style={[styles.primaryButton, !canBook && styles.disabledButton]}
                onPress={handleBookRide}
                disabled={!canBook}
                labelStyle={styles.primaryButtonText}
                buttonColor={colors.accent}
                textColor={colors.accentText}
              >
                Call tricycle
              </PaperButton>
            </View>
          </>
        ) : (
          <>
            {activeRide ? <ActiveRide ride={activeRide} /> : <EmptyRideState />}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent rides</Text>
              {rideHistory.map(ride => (
                <RideRow key={ride.id} ride={ride} />
              ))}
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby tricycles</Text>
          {nearbyDrivers.map(driver => (
            <Card key={driver.id} mode="outlined" style={styles.driverRow}>
              <Card.Content style={styles.driverRowContent}>
                <View style={styles.driverIcon}>
                  <MaterialCommunityIcons name="rickshaw" size={22} color={colors.primary} />
                </View>
                <View style={styles.driverCopy}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.mutedText}>{driver.tricycleNumber} - {driver.plateNumber}</Text>
                </View>
                <Text style={styles.etaText}>{driver.etaMinutes} min</Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>
      <BottomMenu activeTab={tab} onTabChange={setTab} />
      </SafeAreaView>
    </PaperProvider>
  );
}

function createPinnedLocation(input: { field: RouteField; name: string; lat: number; lng: number }): LocationPoint {
  return {
    id: `${input.field}-pin-${input.lat.toFixed(5)}-${input.lng.toFixed(5)}`,
    name: input.name,
    lat: Number(input.lat.toFixed(6)),
    lng: Number(input.lng.toFixed(6))
  };
}

function nudgeLocation(location: LocationPoint, field: RouteField, direction: PinDirection): LocationPoint {
  const delta = {
    north: { lat: PIN_STEP_DEGREES, lng: 0 },
    south: { lat: -PIN_STEP_DEGREES, lng: 0 },
    east: { lat: 0, lng: PIN_STEP_DEGREES },
    west: { lat: 0, lng: -PIN_STEP_DEGREES }
  }[direction];

  return createPinnedLocation({
    field,
    name: location.name.startsWith('Pinned') || location.name.startsWith('My current')
      ? location.name
      : `Pinned ${field === 'pickup' ? 'pickup' : 'drop-off'}`,
    lat: location.lat + delta.lat,
    lng: location.lng + delta.lng
  });
}

function BottomMenu(props: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <View style={styles.bottomMenu}>
      <BottomMenuItem
        icon="navigation-variant"
        label="Book"
        isActive={props.activeTab === 'book'}
        onPress={() => props.onTabChange('book')}
      />
      <BottomMenuItem
        icon="receipt"
        label="Rides"
        isActive={props.activeTab === 'rides'}
        onPress={() => props.onTabChange('rides')}
      />
    </View>
  );
}

function BottomMenuItem(props: {
  icon: 'navigation-variant' | 'receipt';
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: props.isActive }}
      onPress={props.onPress}
      style={[styles.bottomMenuItem, props.isActive && styles.bottomMenuItemActive]}
    >
      <MaterialCommunityIcons
        name={props.icon}
        size={22}
        color={props.isActive ? colors.white : colors.primary}
      />
      <Text style={[styles.bottomMenuLabel, props.isActive && styles.bottomMenuLabelActive]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function RouteSelector(props: {
  pickup: LocationPoint;
  dropoff: LocationPoint;
  activeField: RouteField;
  query: string;
  suggestions: LocationPoint[];
  onActiveFieldChange: (field: RouteField) => void;
  onQueryChange: (query: string) => void;
  onSelectLocation: (location: LocationPoint) => void;
  onSwap: () => void;
  onUseCurrentLocation: () => void;
  onNudgePin: (direction: 'north' | 'south' | 'east' | 'west') => void;
  isLocating: boolean;
}) {
  const prompt = props.activeField === 'pickup' ? 'Search pickup point' : 'Search destination';
  const selectedLocation = props.activeField === 'pickup' ? props.pickup : props.dropoff;

  return (
    <Card mode="outlined" style={styles.routeCard}>
      <Card.Content style={styles.routeCardContent}>
      <View style={styles.routeRows}>
        <View style={styles.routeTimeline}>
          <View style={styles.pickupDotSmall} />
          <View style={styles.timelineLine} />
          <View style={styles.dropoffDotSmall} />
        </View>
        <View style={styles.routeFields}>
          <RouteFieldButton
            label="Pickup"
            value={props.pickup.name}
            icon="radio-button-on"
            isActive={props.activeField === 'pickup'}
            onPress={() => props.onActiveFieldChange('pickup')}
          />
          <View style={styles.routeDivider} />
          <RouteFieldButton
            label="Drop-off"
            value={props.dropoff.name}
            icon="location"
            isActive={props.activeField === 'dropoff'}
            onPress={() => props.onActiveFieldChange('dropoff')}
          />
        </View>
        <Pressable style={styles.swapButton} onPress={props.onSwap} accessibilityRole="button" accessibilityLabel="Swap pickup and drop-off">
          <Ionicons name="swap-vertical" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.pinTools}>
        <PaperButton
          mode="contained-tonal"
          icon="crosshairs-gps"
          loading={props.isLocating}
          style={[styles.currentLocationButton, props.isLocating && styles.disabledButton]}
          onPress={props.onUseCurrentLocation}
          disabled={props.isLocating}
          labelStyle={styles.currentLocationText}
          textColor={colors.primary}
        >
          Use my location
        </PaperButton>

        <View style={styles.coordinatePill}>
          <Ionicons name="pin" size={15} color={colors.muted} />
          <Text style={styles.coordinateText}>
            {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
          </Text>
        </View>
      </View>

      <View style={styles.nudgePanel}>
        <Text style={styles.nudgeLabel}>
          Fine-tune {props.activeField === 'pickup' ? 'pickup' : 'drop-off'} pin
        </Text>
        <View style={styles.nudgeControls}>
          <NudgeButton icon="arrow-up" label="North" onPress={() => props.onNudgePin('north')} />
          <NudgeButton icon="arrow-back" label="West" onPress={() => props.onNudgePin('west')} />
          <NudgeButton icon="arrow-forward" label="East" onPress={() => props.onNudgePin('east')} />
          <NudgeButton icon="arrow-down" label="South" onPress={() => props.onNudgePin('south')} />
        </View>
      </View>

      <PaperTextInput
        value={props.query}
        onChangeText={props.onQueryChange}
        label={prompt}
        mode="outlined"
        left={<PaperTextInput.Icon icon="magnify" color={colors.muted} />}
        style={styles.searchInput}
        outlineStyle={styles.paperInputOutline}
      />

      <View style={styles.suggestionHeader}>
        <Text style={styles.suggestionTitle}>{props.query ? 'Matching places' : 'Suggested places'}</Text>
        <Text style={styles.suggestionHint}>{props.activeField === 'pickup' ? 'Set pickup' : 'Set drop-off'}</Text>
      </View>

      <View style={styles.suggestionList}>
        {props.suggestions.map(location => {
          const isSelected =
            props.activeField === 'pickup' ? props.pickup.id === location.id : props.dropoff.id === location.id;

        return (
          <Pressable
            key={location.id}
            onPress={() => props.onSelectLocation(location)}
            style={[styles.suggestionRow, isSelected && styles.suggestionRowActive]}
          >
            <View style={styles.suggestionIcon}>
              <Ionicons name={props.activeField === 'pickup' ? 'navigate' : 'location'} size={17} color={colors.primary} />
            </View>
            <View style={styles.suggestionCopy}>
              <Text style={styles.suggestionName}>{location.name}</Text>
              <Text style={styles.suggestionMeta}>Barangay route point</Text>
            </View>
            {isSelected ? <Ionicons name="checkmark-circle" size={21} color={colors.success} /> : null}
          </Pressable>
        );
      })}
        {props.suggestions.length === 0 ? (
          <View style={styles.noSuggestions}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <Text style={styles.mutedText}>No saved places match that search.</Text>
          </View>
        ) : null}
      </View>
      </Card.Content>
    </Card>
  );
}

function NudgeButton(props: {
  icon: 'arrow-up' | 'arrow-down' | 'arrow-back' | 'arrow-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.nudgeButton} onPress={props.onPress} accessibilityRole="button" accessibilityLabel={`Move pin ${props.label}`}>
      <Ionicons name={props.icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

function RouteFieldButton(props: {
  label: string;
  value: string;
  icon: 'radio-button-on' | 'location';
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.routeFieldButton, props.isActive && styles.routeFieldButtonActive]} onPress={props.onPress}>
      <Ionicons name={props.icon} size={17} color={props.icon === 'radio-button-on' ? colors.success : colors.danger} />
      <View style={styles.routeFieldCopy}>
        <Text style={styles.routeFieldLabel}>{props.label}</Text>
        <Text style={styles.routeFieldValue} numberOfLines={1}>
          {props.value}
        </Text>
      </View>
    </Pressable>
  );
}

function PendingPinPanel(props: {
  pendingPin: PendingPin;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const fieldLabel = props.pendingPin.field === 'pickup' ? 'pickup' : 'drop-off';

  return (
    <Card mode="outlined" style={styles.pendingPinPanel}>
      <Card.Content style={styles.pendingPinContent}>
      <View style={styles.pendingPinIcon}>
        <Ionicons name={props.pendingPin.field === 'pickup' ? 'navigate' : 'location'} size={18} color={colors.primary} />
      </View>
      <View style={styles.pendingPinCopy}>
        <Text style={styles.pendingPinTitle}>Set this as {fieldLabel}</Text>
        <Text style={styles.pendingPinMeta}>
          {props.pendingPin.location.lat.toFixed(5)}, {props.pendingPin.location.lng.toFixed(5)}
        </Text>
      </View>
      <PaperButton mode="outlined" compact style={styles.pendingCancelButton} labelStyle={styles.pendingCancelText} onPress={props.onCancel}>
        Cancel
      </PaperButton>
      <PaperButton mode="contained" compact style={styles.pendingConfirmButton} labelStyle={styles.pendingConfirmText} onPress={props.onConfirm}>
        Set
      </PaperButton>
      </Card.Content>
    </Card>
  );
}

function MapPanel(props: {
  pickup: LocationPoint;
  dropoff: LocationPoint;
  fare: FareEstimate | null;
  activeField: RouteField;
  pendingPin: PendingPin | null;
  onMapTap: (location: LocationPoint) => void;
}) {
  const isOsrmRoute = props.fare?.source === 'OSRM';
  const leafletHtml = useMemo(
    () => buildLeafletHtml({
      pickup: props.pickup,
      dropoff: props.dropoff,
      pendingPin: props.pendingPin,
      routeCoordinates: props.fare?.routeCoordinates ?? []
    }),
    [props.dropoff, props.fare?.routeCoordinates, props.pendingPin, props.pickup]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    function handleWindowMessage(event: MessageEvent) {
      if (typeof event.data !== 'string') {
        return;
      }
      handleMapPayload(event.data);
    }

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [props.activeField, props.onMapTap]);

  function handleMapMessage(event: WebViewMessageEvent) {
    handleMapPayload(event.nativeEvent.data);
  }

  function handleMapPayload(data: string) {
    try {
      const payload = JSON.parse(data) as { type?: string; lat?: number; lng?: number };
      if (payload.type !== 'map-click' || !Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
        return;
      }

      props.onMapTap(createPinnedLocation({
        field: props.activeField,
        name: `Pinned ${props.activeField === 'pickup' ? 'pickup' : 'drop-off'}`,
        lat: Number(payload.lat),
        lng: Number(payload.lng)
      }));
    } catch {
      return;
    }
  }

  return (
    <View style={styles.mapPanel}>
      {Platform.OS === 'web' ? (
        <View style={styles.leafletFrame}>
          {createElement('iframe', {
            title: 'Tricycall OSM route map',
            srcDoc: leafletHtml,
            style: {
              border: 0,
              width: '100%',
              height: '100%'
            }
          })}
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.leafletWebView}
          onMessage={handleMapMessage}
          javaScriptEnabled
          domStorageEnabled
        />
      )}
      <View style={styles.routeSummary}>
        <View style={styles.routeBadge}>
          <Ionicons name={isOsrmRoute ? 'map' : 'navigate'} size={14} color={colors.primary} />
          <Text style={styles.routeBadgeText}>{isOsrmRoute ? 'OSRM route' : 'Local estimate'}</Text>
        </View>
        <Text style={styles.routeText}>{props.pickup.name}</Text>
        <Ionicons name="arrow-down" size={16} color={colors.muted} />
        <Text style={styles.routeText}>{props.dropoff.name}</Text>
        <Text style={styles.routeHint}>Tap map to preview {props.activeField === 'pickup' ? 'pickup' : 'drop-off'} pin</Text>
      </View>
    </View>
  );
}

function buildLeafletHtml(input: {
  pickup: LocationPoint;
  dropoff: LocationPoint;
  pendingPin: PendingPin | null;
  routeCoordinates: Array<{ lat: number; lng: number }>;
}) {
  const centerLat = (input.pickup.lat + input.dropoff.lat) / 2;
  const centerLng = (input.pickup.lng + input.dropoff.lng) / 2;
  const route = input.routeCoordinates.length > 0
    ? input.routeCoordinates
    : [input.pickup, input.dropoff].map(point => ({ lat: point.lat, lng: point.lng }));

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no,width=device-width" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; padding: 0; margin: 0; }
    .leaflet-container { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .pin { width: 28px; height: 28px; border-radius: 14px; display: grid; place-items: center; color: ${colors.white}; font-weight: 800; border: 3px solid ${colors.white}; box-shadow: 0 4px 10px rgba(0,0,0,.22); }
    .pickup { background: ${colors.success}; }
    .dropoff { background: ${colors.danger}; }
    .pending { background: ${colors.accent}; color: ${colors.accentText}; border-color: ${colors.primary}; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const pickup = ${JSON.stringify({ lat: input.pickup.lat, lng: input.pickup.lng, name: input.pickup.name })};
    const dropoff = ${JSON.stringify({ lat: input.dropoff.lat, lng: input.dropoff.lng, name: input.dropoff.name })};
    const pendingPin = ${JSON.stringify(input.pendingPin ? {
      lat: input.pendingPin.location.lat,
      lng: input.pendingPin.location.lng,
      name: input.pendingPin.location.name,
      field: input.pendingPin.field
    } : null)};
    const route = ${JSON.stringify(route)};
    const map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const pickupIcon = L.divIcon({ html: '<div class="pin pickup">P</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    const dropoffIcon = L.divIcon({ html: '<div class="pin dropoff">D</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    const pendingIcon = L.divIcon({ html: '<div class="pin pending">' + (pendingPin?.field === 'pickup' ? 'P' : 'D') + '</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(map).bindTooltip(pickup.name);
    L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon }).addTo(map).bindTooltip(dropoff.name);
    if (pendingPin) {
      L.marker([pendingPin.lat, pendingPin.lng], { icon: pendingIcon }).addTo(map).bindTooltip('Preview ' + (pendingPin.field === 'pickup' ? 'pickup' : 'drop-off'));
    }

    const polyline = L.polyline(route.map(point => [point.lat, point.lng]), { color: '${colors.primary}', weight: 5, opacity: 0.9 }).addTo(map);
    map.fitBounds(polyline.getBounds().pad(0.35), { animate: false });

    map.on('click', event => {
      const message = JSON.stringify({ type: 'map-click', lat: event.latlng.lat, lng: event.latlng.lng });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(message);
      } else if (window.parent) {
        window.parent.postMessage(message, '*');
      }
    });
  </script>
</body>
</html>`;
}

function FarePanel(props: { fare: FareEstimate | null; isLoading: boolean }) {
  return (
    <Card mode="outlined" style={styles.farePanel}>
      <Card.Content style={styles.farePanelContent}>
      <View>
        <Text style={styles.label}>Estimated fare</Text>
        <Text style={styles.fareText}>
          {props.fare ? `${props.fare.currency} ${props.fare.fare}` : 'Select a route'}
        </Text>
      </View>
      <View style={styles.metricGroup}>
        <Text style={styles.metricValue}>{props.fare ? `${props.fare.distanceKm} km` : '--'}</Text>
        <Text style={styles.metricLabel}>Distance</Text>
      </View>
      <View style={styles.metricGroup}>
        <Text style={styles.metricValue}>{props.fare ? `${props.fare.etaMinutes} min` : '--'}</Text>
        <Text style={styles.metricLabel}>ETA</Text>
      </View>
      <View style={styles.metricGroup}>
        <Text style={styles.metricValue}>{props.fare?.source === 'OSRM' ? 'OSRM' : 'Local'}</Text>
        <Text style={styles.metricLabel}>Basis</Text>
      </View>
      {props.isLoading ? <PaperActivityIndicator color={colors.primary} /> : null}
      </Card.Content>
    </Card>
  );
}

function ActiveRide({ ride }: { ride: Ride }) {
  return (
    <Card mode="outlined" style={styles.activeRide}>
      <Card.Content>
      <View style={styles.activeRideHeader}>
        <Text style={styles.sectionTitle}>Active ride</Text>
        <Chip compact style={styles.statusBadge} textStyle={styles.statusBadgeText}>
          {ride.status.replace('_', ' ')}
        </Chip>
      </View>
      <Text style={styles.activeRoute}>{ride.pickup.name} to {ride.dropoff.name}</Text>
      <Text style={styles.mutedText}>
        {ride.currency} {ride.fare} - {ride.distanceKm} km - {ride.fareSource === 'OSRM' ? 'OSRM route pricing' : 'Local fare estimate'}
      </Text>
      <View style={styles.driverRowCompact}>
        <View style={styles.driverIcon}>
          <MaterialCommunityIcons name="rickshaw" size={22} color={colors.primary} />
        </View>
        <View style={styles.driverCopy}>
          <Text style={styles.driverName}>{ride.driver?.name ?? 'Dispatching driver'}</Text>
          <Text style={styles.mutedText}>
            {ride.driver ? `${ride.driver.tricycleNumber} - ${ride.driver.plateNumber}` : 'Please wait nearby'}
          </Text>
        </View>
        <Text style={styles.etaText}>{ride.etaMinutes} min</Text>
      </View>
      </Card.Content>
    </Card>
  );
}

function EmptyRideState() {
  return (
    <Card mode="outlined" style={styles.emptyState}>
      <Card.Content style={styles.emptyStateContent}>
      <MaterialCommunityIcons name="rickshaw-electric" size={34} color={colors.primary} />
      <Text style={styles.emptyTitle}>No active ride</Text>
      <Text style={styles.mutedText}>Book a tricycle and your driver details will appear here.</Text>
      </Card.Content>
    </Card>
  );
}

function RideRow({ ride }: { ride: Ride }) {
  return (
    <Card mode="outlined" style={styles.rideRow}>
      <Card.Content style={styles.rideRowContent}>
      <View>
        <Text style={styles.rideRoute}>{ride.pickup.name} to {ride.dropoff.name}</Text>
        <Text style={styles.mutedText}>
          {ride.status.replace('_', ' ')} - {ride.distanceKm} km - {ride.fareSource === 'OSRM' ? 'OSRM' : 'Local'}
        </Text>
      </View>
      <Text style={styles.rideFare}>{ride.currency} {ride.fare}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.primary
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  brand: {
    color: colors.white,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.primarySoft,
    fontSize: 13,
    marginTop: 2
  },
  statusPill: {
    width: 108,
    height: 42,
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 0,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  statusPillOffline: {
    backgroundColor: colors.dangerSoft
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 14,
    paddingBottom: 112,
    backgroundColor: colors.background
  },
  bottomMenu: {
    minHeight: 76,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: 10
  },
  bottomMenuItem: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  bottomMenuItemActive: {
    backgroundColor: colors.primary
  },
  bottomMenuLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900'
  },
  bottomMenuLabelActive: {
    color: colors.white
  },
  mapPanel: {
    minHeight: 358,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border
  },
  leafletFrame: {
    minHeight: 252,
    backgroundColor: colors.mapCanvas
  },
  leafletWebView: {
    minHeight: 252,
    backgroundColor: colors.mapCanvas
  },
  routeSummary: {
    width: '100%',
    padding: 12,
    backgroundColor: colors.surface,
    gap: 8
  },
  routeBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5
  },
  routeBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900'
  },
  routeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  routeHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    maxWidth: 300
  },
  pendingPinPanel: {
    minHeight: 68,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  pendingPinContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  pendingPinIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pendingPinCopy: {
    flex: 1
  },
  pendingPinTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  pendingPinMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  pendingCancelButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pendingCancelText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900'
  },
  pendingConfirmButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pendingConfirmText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900'
  },
  section: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  routeCard: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  routeCardContent: {
    gap: 12
  },
  routeRows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  routeTimeline: {
    width: 18,
    alignItems: 'center'
  },
  pickupDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success
  },
  dropoffDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.danger
  },
  timelineLine: {
    width: 2,
    height: 42,
    backgroundColor: colors.borderStrong,
    marginVertical: 4
  },
  routeFields: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    backgroundColor: colors.surfaceTint,
    overflow: 'hidden'
  },
  routeFieldButton: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent'
  },
  routeFieldButtonActive: {
    backgroundColor: colors.primarySoft,
    borderLeftColor: colors.primary
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 39
  },
  routeFieldCopy: {
    flex: 1
  },
  routeFieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  routeFieldValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2
  },
  swapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  pinTools: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8
  },
  currentLocationButton: {
    width: '100%',
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10
  },
  currentLocationText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900'
  },
  coordinatePill: {
    width: '100%',
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10
  },
  coordinateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800'
  },
  nudgePanel: {
    borderRadius: 8,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 9
  },
  nudgeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  nudgeControls: {
    flexDirection: 'row',
    gap: 8
  },
  nudgeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900'
  },
  suggestionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800'
  },
  suggestionList: {
    gap: 8
  },
  suggestionRow: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: colors.surfaceTint,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  suggestionRowActive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  suggestionCopy: {
    flex: 1
  },
  suggestionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  noSuggestions: {
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  inputGroup: {
    flex: 1,
    minWidth: 150,
    gap: 6
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  input: {
    minHeight: 46,
    backgroundColor: colors.surface,
    color: colors.text
  },
  paperInputOutline: {
    borderRadius: 8,
    borderColor: colors.border
  },
  farePanel: {
    minHeight: 84,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  farePanelContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  fareText: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2
  },
  metricGroup: {
    alignItems: 'flex-end'
  },
  metricValue: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900'
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  primaryButton: {
    flex: 1.15,
    minWidth: 156,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  secondaryButton: {
    flex: 1,
    minWidth: 144,
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  disabledButton: {
    opacity: 0.5
  },
  primaryButtonText: {
    color: colors.accentText,
    fontSize: 15,
    fontWeight: '900'
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900'
  },
  driverRow: {
    minHeight: 66,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  driverRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  driverRowCompact: {
    minHeight: 66,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  driverIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  driverCopy: {
    flex: 1
  },
  driverName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  etaText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900'
  },
  activeRide: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10
  },
  statusBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999
  },
  statusBadgeText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '900'
  },
  activeRoute: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10
  },
  emptyState: {
    minHeight: 140,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  emptyStateContent: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  rideRow: {
    minHeight: 64,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  rideRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  rideRoute: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  rideFare: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900'
  }
});
