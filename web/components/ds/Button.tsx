import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

const ICON_SIZE = { sm: 16, md: 17, lg: 18 } as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  icon?: IconName;
  iconRight?: IconName;
};

export function Button({ variant = "primary", size = "md", tone = "light", icon, iconRight, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={[styles.button, styles[variant], styles[size], tone === "dark" && styles.dark, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={ICON_SIZE[size]} />}
    </button>
  );
}
