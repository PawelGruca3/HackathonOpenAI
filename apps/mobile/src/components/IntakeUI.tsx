import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '@/theme';

export const ui = StyleSheet.create({
  title: { fontSize: 27, fontWeight: '700', color: colors.text, letterSpacing: -.5 },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 8 },
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
  muted: { fontSize: 14, lineHeight: 22, color: '#606060' },
  small: { fontSize: 12, lineHeight: 18, color: '#606060' },
  label: { fontSize: 13, fontWeight: '600', color: '#505050', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  card: { padding: 18, borderRadius: 14, backgroundColor: colors.surface, gap: 12, borderWidth: 1, borderColor: colors.border },
  input: { borderWidth: 1, borderColor: '#d0d0d0', padding: 14, borderRadius: 10, fontSize: 16, color: colors.text, backgroundColor: 'white', minHeight: 48 },
  chip: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#f3f3f3', borderRadius: 10, minHeight: 44 },
  chipSelected: { backgroundColor: '#f5f8fd', borderWidth: 1, borderColor: '#175fc2' },
  chipText: { color: '#242424', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
});
export function Screen({ title, subtitle, children, back = true, footer }: { title: string; subtitle?: string; children: ReactNode; back?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>{back ? <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Back</Text></Pressable> : <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '800', paddingVertical: 12 }}>intake</Text>}<Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle && <Text style={[ui.muted, { marginTop: 8 }]}>{subtitle}</Text>}</View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, gap: 20, paddingBottom: Math.max(insets.bottom, 24) }}>{children}</ScrollView>
    {footer && <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), gap: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>{footer}</View>}
  </KeyboardAvoidingView>;
}
export function Action({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={({ pressed }) => ({ minHeight: 52, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: secondary ? '#ffffff' : '#171717', borderWidth: secondary ? 1 : 0, borderColor: colors.border, opacity: disabled ? .45 : pressed ? .75 : 1 })}><Text style={{ color: secondary ? '#242424' : 'white', fontWeight: '700', fontSize: 16 }}>{title}</Text></Pressable>;
}
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open,setOpen]=useState(false);
  return <View style={{gap:12,borderTopWidth:1,borderColor:colors.border,paddingTop:12}}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} aria-expanded={open} onPress={()=>setOpen(!open)} style={{minHeight:48,justifyContent:'center'}}><Text style={ui.heading}>{title} {open?'−':'+'}</Text></Pressable>{open&&children}</View>;
}
export function ErrorMessage({ message, retry }: { message: string; retry?: () => void }) {
  return <View accessibilityRole="alert" style={{ backgroundColor: '#fff0f0', padding: 16, borderRadius: 12, gap: 12 }}><Text style={{ color: '#9d2933', lineHeight: 22 }}>{message}</Text>{retry && <Action title="Try again" onPress={retry} secondary />}</View>;
}
export function Busy({ label = 'Loading your intake…' }: { label?: string }) { return <View style={{ padding: 32, gap: 16, alignItems: 'center' }} accessibilityRole="progressbar"><ActivityIndicator color={colors.primary} /><Text style={ui.muted}>{label}</Text></View>; }
export function Field({ label, value, onChange, numeric = false, multiline = false, placeholder }: { label: string; value: string; onChange: (text: string) => void; numeric?: boolean; multiline?: boolean; placeholder?: string }) {
  return <View style={{ flex: 1 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} maxLength={multiline ? 5000 : 12} placeholder={placeholder} placeholderTextColor="#737373" style={[ui.input, multiline && { minHeight: 110, textAlignVertical: 'top' }]} /></View>;
}
