export type UserType =
  | "farmer"
  | "breeder"
  | "supplier"
  | "service_provider"
  | "buyer"
  | "cooperative";

export type VerificationStatus =
  | "pending"
  | "phone_verified"
  | "id_verified"
  | "business_verified";

export interface User {
  id: string;
  phoneNumber: string;
  email?: string | null;
  fullName: string;
  userType: UserType;
  verificationStatus: VerificationStatus;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}
