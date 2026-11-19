export const CAMPAIGN_DEVICES=[
 'switch','branch','conveyor','charge','switchback','fuse','dual',
 'cascade','relay','fall','rocket','forge','pollinate','streak',
] as const;

export const WORKSHOP_DEVICES=['twin-plates','portal','dye','scale','mirror','updraft'] as const;
export type WorkshopDeviceKind=typeof WORKSHOP_DEVICES[number];
export const GREENHOUSE_DEVICES=['turntable','keys','pollen','carrier','echo','reflector'] as const;
export type GreenhouseDeviceKind=typeof GREENHOUSE_DEVICES[number];
export type CampaignDeviceKind=typeof CAMPAIGN_DEVICES[number]|WorkshopDeviceKind|GreenhouseDeviceKind;
export interface CampaignDevice {
 kind:CampaignDeviceKind;
 zones:number[][];
 target:number;
 gate?:number;
}

export function campaignDeviceGateCells(step:CampaignDevice):number[]{
 const gate=step.gate===undefined?[]:[step.gate];
 return step.kind==='keys'?[...gate,...(step.zones[1]??[])]:gate;
}

export interface CampaignDevicesState {
 steps:CampaignDevice[];
 index:number;
 progress:number;
 branch?:0|1;
 color?:string;
 chargedPlates?:number[];
 pans?:[number,number];
 openedLocks?:number[];
 pollenIds?:number[];
 echoAt?:number;
}
