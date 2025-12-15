// MommaBsHouseholdTheme.tsx
// A concrete, recreatable "control-tower" theme + layout primitives for modules + scanner pages.
// Drop into a React Native (Expo) app. TypeScript. No external UI libs required.

import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ViewStyle,
  TextStyle,
} from "react-native";

/* ============================================================================
   THEME TOKENS (single source of truth)
   ----------------------------------------------------------------------------
   Philosophy encoded:
   - White/near-white surfaces, slate/charcoal structure
   - Containment + segmentation
   - Calm authority, low-chroma accents for status only
   - No playful bounce, no decorative gradients
============================================================================ */

export const Theme = {
  color: {
    // Surfaces
    bg: "#F8FAFC", // near-white (clean canvas)
    panel: "#FFFFFF",
    panelMuted: "#F1F5F9", // subtle section background
    border: "#E2E8F0", // light structure line

    // Structural darks (icon frame language)
    ink: "#0F172A", // primary text / structural
    inkMuted: "#334155", // secondary
    frame: "#111827", // strong frame (scanner + control tower boundaries)
    frameSoft: "#1F2937", // slightly lifted frame layer

    // Module frame colors (app icon backgrounds)
    frameHousehold: "#3B7EFF", // bright blue
    frameScanner: "#28A745", // bright green
    framePantry: "#8B5CF6", // bright purple

    // Status (used sparingly; never decoration)
    ok: "#16A34A",
    warn: "#D97706",
    bad: "#DC2626",
    info: "#2563EB",
  },

  radius: {
    app: 24, // overall app rounding
    frame: 18, // inner frame tighter
    tile: 14, // tiles slightly softer
    section: 16,
    input: 14,
    pill: 999,
  },

  space: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },

  // Calm, deliberate hierarchy: weight + spacing (not color)
  type: {
    title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: 0.2 },
    h2: { fontSize: 16, fontWeight: "700" as const, letterSpacing: 0.2 },
    body: { fontSize: 15, fontWeight: "500" as const, letterSpacing: 0.1 },
    meta: { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.2 },
    caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.2 },
  },

  // Motion policy: short, linear (no spring).
  motion: {
    // Keep here for future Animations; use with Reanimated or Animated.
    durationFastMs: 120,
    durationMedMs: 180,
    easing: "linear" as const,
  },

  // Shadows: subtle authority only (micro-depth), platform-aware.
  shadow: {
    frame: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
      default: {},
    }) as ViewStyle,
    panel: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }) as ViewStyle,
  },
} as const;

/* ============================================================================
   PRIMITIVES: Containment + Segmentation
============================================================================ */

type ScreenProps = {
  title: string;
  subtitle?: string;
  rightAccessory?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "scanner";
};

/**
 * ScreenShell
 * - Default tone: near-white canvas, structured header, content in sections.
 * - Scanner tone: darker operational surface; still structured, not playful.
 */
export function ScreenShell({
  title,
  subtitle,
  rightAccessory,
  children,
  tone = "default",
}: ScreenProps) {
  const isScanner = tone === "scanner";

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isScanner ? Theme.color.frame : Theme.color.bg },
      ]}
    >
      <StatusBar
        barStyle={isScanner ? "light-content" : "dark-content"}
        backgroundColor={isScanner ? Theme.color.frame : Theme.color.bg}
      />

      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.title,
                isScanner && { color: "#FFFFFF" },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  isScanner && { color: "rgba(255,255,255,0.78)" },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>

          {!!rightAccessory && <View style={styles.headerAccessory}>{rightAccessory}</View>}
        </View>

        {/* structural divider (quiet, not decorative) */}
        <View
          style={[
            styles.headerDivider,
            { backgroundColor: isScanner ? "rgba(255,255,255,0.10)" : Theme.color.border },
          ]}
        />
      </View>

      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

type SectionProps = {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  tone?: "default" | "muted" | "scanner";
  style?: ViewStyle;
};

/**
 * Section
 * - A contained region (panel), grouped content, no floating.
 * - Mirrors the "frame → tiles → content" logic from the icon.
 */
export function Section({ title, hint, children, tone = "default", style }: SectionProps) {
  const isScanner = tone === "scanner";
  const bg =
    tone === "muted"
      ? Theme.color.panelMuted
      : isScanner
        ? Theme.color.frameSoft
        : Theme.color.panel;

  const borderColor = isScanner ? "rgba(255,255,255,0.10)" : Theme.color.border;

  return (
    <View style={[styles.section, { backgroundColor: bg, borderColor }, style]}>
      {(title || hint) && (
        <View style={styles.sectionHeader}>
          {!!title && (
            <Text style={[styles.sectionTitle, isScanner && { color: "#FFFFFF" }]}>
              {title}
            </Text>
          )}
          {!!hint && (
            <Text style={[styles.sectionHint, isScanner && { color: "rgba(255,255,255,0.72)" }]}>
              {hint}
            </Text>
          )}
        </View>
      )}
      <View>{children}</View>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  tone?: "default" | "scanner";
};

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  tone = "default",
}: ActionButtonProps) {
  const isScanner = tone === "scanner";

  const bg =
    variant === "primary"
      ? isScanner
        ? "rgba(255,255,255,0.12)"
        : Theme.color.ink
      : "transparent";

  const borderColor =
    variant === "ghost"
      ? isScanner
        ? "rgba(255,255,255,0.20)"
        : Theme.color.border
      : "transparent";

  const textColor =
    variant === "primary"
      ? "#FFFFFF"
      : isScanner
        ? "#FFFFFF"
        : Theme.color.ink;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

/* ============================================================================
   ICON-LANGUAGE COMPONENT (framed 3x3 grid) — for use in app + module tiles
   ----------------------------------------------------------------------------
   This lets you render "the icon" in-app (e.g., module picker, empty states),
   and derive module variants by changing which tiles are emphasized.
============================================================================ */

export type GridEmphasis = {
  // 0..8 indices (row-major) that should appear emphasized
  emphasize?: number[];
  // optional: de-emphasize certain tiles
  deemphasize?: number[];
};

type ControlTowerMarkProps = {
  size?: number;
  emphasis?: GridEmphasis;
  inverted?: boolean; // for scanner/dark surfaces
  frameColor?: string; // custom frame color
};

/**
 * ControlTowerMark
 * - Outer dark frame with micro-depth
 * - 3x3 tiles inside
 * - Optional emphasis rules to create module variants without changing the system
 */
export function ControlTowerMark({
  size = 72,
  emphasis,
  inverted = false,
  frameColor,
}: ControlTowerMarkProps) {
  const tileGap = Math.round(size * 0.065); // proportionate spacing
  const tileSize = Math.round((size - tileGap * 4) / 3);

  const frameBg = frameColor || (inverted ? "rgba(255,255,255,0.14)" : Theme.color.ink);
  const tileBase = inverted ? "rgba(255,255,255,0.85)" : "#FFFFFF";
  const tileDim = inverted ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.70)";

  const emphasized = new Set(emphasis?.emphasize ?? []);
  const deemphasized = new Set(emphasis?.deemphasize ?? []);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Theme.radius.frame,
          backgroundColor: frameBg,
          padding: tileGap,
        },
        Theme.shadow.frame,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: Theme.radius.frame - 4,
          // micro-depth: very subtle inner boundary
          borderWidth: 1,
          borderColor: inverted ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.10)",
          padding: tileGap,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tileGap }}>
          {Array.from({ length: 9 }).map((_, i) => {
            const isEmph = emphasized.has(i);
            const hasEmphasis = emphasized.size > 0;

            // Match web icon generator logic:
            // - If no emphasis pattern, all tiles are full opacity
            // - If emphasis pattern exists, emphasized tiles are full opacity, others are dimmed
            const opacity = hasEmphasis
              ? (isEmph ? 1.0 : 0.70)
              : 1.0;

            return (
              <View
                key={i}
                style={{
                  width: tileSize,
                  height: tileSize,
                  borderRadius: Theme.radius.tile,
                  backgroundColor: tileBase,
                  opacity,
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ============================================================================
   MODULE PAGES (examples)
   ----------------------------------------------------------------------------
   - Same system: header + contained sections
   - Module variation: emphasis pattern + which sections are present
============================================================================ */

export function ModuleHomeExample() {
  return (
    <ScreenShell
      title="Household"
      subtitle="Control Tower"
      rightAccessory={
        <ControlTowerMark size={42} emphasis={{ emphasize: [4] }} /> // subtle "core"
      }
    >
      <Section title="Overview" hint="Status across domains">
        <Row label="Pantry alerts" value="2" />
        <Row label="Inventory expiring" value="5" />
        <Row label="Maintenance due" value="1" />
      </Section>

      <Section title="Domains" hint="Choose a module" tone="muted">
        <ModuleTile
          label="Pantry"
          emphasis={{ emphasize: [0, 1, 2, 3] }} // denser / "tighter"
          onPress={() => {}}
        />
        <ModuleTile
          label="Finance"
          emphasis={{ emphasize: [0, 3, 6] }} // vertical segmentation feel
          onPress={() => {}}
        />
        <ModuleTile
          label="Maintenance"
          emphasis={{ emphasize: [2, 4, 6] }} // diagonal "action"
          onPress={() => {}}
        />
      </Section>
    </ScreenShell>
  );
}

function ModuleTile({
  label,
  emphasis,
  onPress,
}: {
  label: string;
  emphasis: GridEmphasis;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.moduleTile, pressed && { opacity: 0.92 }]}>
      <ControlTowerMark size={54} emphasis={emphasis} />
      <View style={{ flex: 1 }}>
        <Text style={styles.moduleTitle}>{label}</Text>
        <Text style={styles.moduleMeta}>Contained, governed domain</Text>
      </View>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/* ============================================================================
   SCANNER PAGE (operational surface)
   ----------------------------------------------------------------------------
   - Dark surface
   - Strong scan frame
   - Rectangular overlays, minimal motion (not implemented here)
============================================================================ */

export function ScannerPageExample() {
  return (
    <ScreenShell
      title="Scan"
      subtitle="Operational mode"
      tone="scanner"
      rightAccessory={<ControlTowerMark size={40} inverted />}
    >
      <Section
        title="Scanner"
        hint="Align barcode inside the frame"
        tone="scanner"
        style={{ padding: Theme.space.lg }}
      >
        <ScanFrame />
        <View style={{ height: Theme.space.md }} />
        <StatusPanel
          tone="scanner"
          status="ready"
          title="Ready"
          detail="Point the camera at a UPC or QR code."
        />
      </Section>

      <View style={{ height: Theme.space.md }} />

      <Section tone="scanner" title="Actions" hint="Fast, controlled decisions">
        <View style={{ flexDirection: "row", gap: Theme.space.sm }}>
          <ActionButton tone="scanner" label="Manual entry" onPress={() => {}} variant="ghost" />
          <ActionButton tone="scanner" label="Recent scans" onPress={() => {}} variant="ghost" />
        </View>
      </Section>
    </ScreenShell>
  );
}

function ScanFrame() {
  return (
    <View style={styles.scanWrap}>
      <View style={styles.scanFrame}>
        {/* subtle grid inside scanner frame (optional): conveys "structured capture" */}
        <View style={styles.scanGrid} />
      </View>
    </View>
  );
}

function StatusPanel({
  tone,
  status,
  title,
  detail,
}: {
  tone: "scanner";
  status: "ready" | "found" | "unknown" | "needs_review";
  title: string;
  detail: string;
}) {
  const border =
    status === "found"
      ? Theme.color.ok
      : status === "unknown"
        ? Theme.color.warn
        : status === "needs_review"
          ? Theme.color.bad
          : "rgba(255,255,255,0.18)";

  return (
    <View style={[styles.statusPanel, { borderColor: border }]}>
      <Text style={[styles.statusTitle, { color: "#FFFFFF" }]}>{title}</Text>
      <Text style={[styles.statusDetail, { color: "rgba(255,255,255,0.78)" }]}>{detail}</Text>
    </View>
  );
}

/* ============================================================================
   STYLES (kept boring and systematic)
============================================================================ */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  headerWrap: {
    paddingHorizontal: Theme.space.lg,
    paddingTop: Theme.space.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Theme.space.md },
  headerAccessory: { justifyContent: "center", alignItems: "center" },

  title: {
    color: Theme.color.ink,
    ...(Theme.type.title as TextStyle),
  },
  subtitle: {
    marginTop: Theme.space.xxs,
    color: Theme.color.inkMuted,
    ...(Theme.type.meta as TextStyle),
  },

  headerDivider: {
    height: 1,
    marginTop: Theme.space.md,
  },

  body: {
    flex: 1,
    paddingHorizontal: Theme.space.lg,
    paddingTop: Theme.space.lg,
    gap: Theme.space.md,
  },

  section: {
    borderWidth: 1,
    borderRadius: Theme.radius.section,
    padding: Theme.space.lg,
    ...Theme.shadow.panel,
  },
  sectionHeader: { marginBottom: Theme.space.md, gap: Theme.space.xxs },
  sectionTitle: { color: Theme.color.ink, ...(Theme.type.h2 as TextStyle) },
  sectionHint: { color: Theme.color.inkMuted, ...(Theme.type.caption as TextStyle) },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Theme.space.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.color.border,
  },
  rowLabel: { color: Theme.color.inkMuted, ...(Theme.type.body as TextStyle) },
  rowValue: { color: Theme.color.ink, ...(Theme.type.body as TextStyle) },

  moduleTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.space.md,
    paddingVertical: Theme.space.sm,
  },
  moduleTitle: { color: Theme.color.ink, ...(Theme.type.h2 as TextStyle) },
  moduleMeta: { marginTop: Theme.space.xxs, color: Theme.color.inkMuted, ...(Theme.type.caption as TextStyle) },

  btn: {
    paddingVertical: Theme.space.sm,
    paddingHorizontal: Theme.space.md,
    borderRadius: Theme.radius.input,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  btnText: { ...(Theme.type.meta as TextStyle) },

  scanWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.space.lg,
  },
  scanFrame: {
    width: 260,
    height: 190,
    borderRadius: Theme.radius.section,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  scanGrid: {
    flex: 1,
    // faint internal structure to reinforce "governed capture"
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },

  statusPanel: {
    borderWidth: 1,
    borderRadius: Theme.radius.section,
    padding: Theme.space.md,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusTitle: { ...(Theme.type.h2 as TextStyle) },
  statusDetail: { marginTop: Theme.space.xxs, ...(Theme.type.body as TextStyle) },
});

/* ============================================================================
   HOW TO USE (example)
   ----------------------------------------------------------------------------
   In your app/router:
   - <ModuleHomeExample />
   - <ScannerPageExample />

   Module variants:
   - Keep ControlTowerMark + same frame
   - Change emphasis sets only
============================================================================ */
