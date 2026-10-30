import appConfig from '../app.json';

/** 版本号唯一来源：app.json（构建产物与界面一致）。 */
export const APP_VERSION: string = appConfig.expo.version;
