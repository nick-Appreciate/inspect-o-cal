import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  email: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ avatarUrl, name, email, size = "sm" }: UserAvatarProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // Get initials from name or email
  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarImage src={avatarUrl || undefined} alt={name || email} />
      <AvatarFallback className={textSizeClasses[size]}>
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}
