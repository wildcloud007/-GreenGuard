export interface ServicePackage {
  id: string;
  title: string;
  description: string;
  features: string[];
  priceRange: string;
  icon: string;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AppointmentDetails {
  customerName: string;
  address: string;
  serviceInterest: string;
  preferredTime: string;
}