export type InspectionType = 
  | "S8 - RFT"
  | "S8 - 1st Annual"
  | "S8 - Reinspection"
  | "S8 - Abatement Cure"
  | "Rental License"
  | "HUD";

export interface Property {
  id: string;
  name: string;
  address: string;
}

export interface Inspection {
  id: string;
  type: InspectionType;
  date: Date;
  time: string;
  property: Property;
  attachment?: File;
  attachmentUrl?: string;
  duration?: number; // in minutes
  parent_inspection_id?: string | null;
}
