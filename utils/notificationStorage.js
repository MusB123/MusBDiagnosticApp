import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'READ_NOTIFICATION_IDS';

export async function getReadIds() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export async function markIdsRead(ids) {
  try {
    const current = await getReadIds();
    ids.forEach((id) => current.add(id));
    await AsyncStorage.setItem(KEY, JSON.stringify([...current]));
  } catch {
    // best-effort, ignore
  }
}