export type TUser = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null | undefined | undefined;
    banned: boolean | null | undefined;
    role?: string | null | undefined;
    banReason?: string | null | undefined;
    banExpires?: Date | null | undefined;
}