import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultState, parseState, STORAGE_KEY } from './schema';
import { PersistedState } from '../types';

/** 读取：缺省/损坏/异常一律回退默认状态。 */
export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return createDefaultState();
    return parseState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

/** 写入：失败不中断使用（单机记录场景）。 */
export async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败
  }
}

export async function resetState(): Promise<PersistedState> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略移除失败
  }
  return createDefaultState();
}
