import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const colors = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  border: '#D7E2EA',
  text: '#102027',
  muted: '#60717A',
  primary: '#006B5E',
  primarySoft: '#DDF3EF',
  accent: '#FFB703',
  accentText: '#2A1800',
  danger: '#D94A3A',
  dangerSoft: '#FFE6D6',
  white: '#FFFFFF'
};

export default function KillPage() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="shield-alert" size={30} color={colors.danger} />
          </View>
          <Text style={styles.eyebrow}>Emergency controls</Text>
          <Text style={styles.title}>Kill page</Text>
          <Text style={styles.description}>
            A dedicated safety page placeholder for stopping risky actions, pausing dispatch activity, and guiding
            operators through a controlled shutdown flow.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before you continue</Text>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.checkText}>Confirm active rides have been reviewed.</Text>
          </View>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.checkText}>Notify available drivers before pausing dispatch.</Text>
          </View>
          <View style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.checkText}>Record the reason for the shutdown in operations notes.</Text>
          </View>
        </View>

        <Pressable style={styles.primaryAction} accessibilityRole="button">
          <Ionicons name="power" size={20} color={colors.accentText} />
          <Text style={styles.primaryActionText}>Prepare shutdown</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 32
  },
  heroCard: {
    gap: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface
  },
  iconBadge: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.dangerSoft
  },
  eyebrow: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800'
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24
  },
  section: {
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.white
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  checkText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  },
  primaryAction: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.accent
  },
  primaryActionText: {
    color: colors.accentText,
    fontSize: 16,
    fontWeight: '800'
  }
});
