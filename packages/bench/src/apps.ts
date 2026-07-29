export interface AppTarget {
  name: string;
  workspace: string;
  port: number;
}

/**
 * Every implementation registers here. The
 *  parity suite and the benchmark runner both iterate this list, so
 * a new app is picked up by both without touching either.
 */
export const APP_TARGETS: AppTarget[] = [
  { name: 'zustand', workspace: '@smc/app-zustand', port: 4173 },
  { name: 'rxjs', workspace: '@smc/app-rxjs', port: 4174 },
  { name: 'mobx', workspace: '@smc/app-mobx', port: 4175 },
  { name: 'jotai', workspace: '@smc/app-jotai', port: 4176 },
  { name: 'redux', workspace: '@smc/app-redux', port: 4177 },
];
