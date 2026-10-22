// 手写 shim：re-export 同一份 redi（见 build-esm.mjs 注释）
import * as __redi from '/__bare/@wendellhu/redi/react-bindings';
export const RediConsumer = __redi["RediConsumer"];
export const RediContext = __redi["RediContext"];
export const RediProvider = __redi["RediProvider"];
export const WithDependency = __redi["WithDependency"];
export const connectDependencies = __redi["connectDependencies"];
export const connectInjector = __redi["connectInjector"];
export const useDependency = __redi["useDependency"];
export const useInjector = __redi["useInjector"];
export const useObservable = __redi["useObservable"];
export const useUpdateBinder = __redi["useUpdateBinder"];
export default __redi;
