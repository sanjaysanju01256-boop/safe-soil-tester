// Fix for Web Bluetooth API types not being available in default TypeScript lib.
declare global {
  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string;
    gatt?: {
        connect: () => Promise<any>; // Simplified for this context
        disconnect: () => void;
    };
    addEventListener(type: 'gattserverdisconnected', listener: (this: this, ev: Event) => any, useCapture?: boolean): void;
  }

  interface Navigator {
    readonly bluetooth: {
      requestDevice(options?: {
        filters?: { name?: string }[];
        optionalServices?: string[];
      }): Promise<BluetoothDevice>;
    };
  }
}

// --- Data Models ---
export interface SoilData {
  ph: number;
  moisture: number;
  temperature: number;
}

export interface SensorData extends SoilData {
  battery: number;
}

export type HistoryRecord = {
  timestamp: number;
  data: SensorData;
};

export type Theme = 'light' | 'dark';

export type ControlName = 'pump' | 'fan' | 'light';

export type Controls = Record<ControlName, boolean>;
