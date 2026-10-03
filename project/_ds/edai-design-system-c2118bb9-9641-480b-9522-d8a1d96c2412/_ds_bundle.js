/* @ds-bundle: {"format":4,"namespace":"EdAIDesignSystem_c2118b","components":[{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"LogoPanel","sourcePath":"components/brand/LogoPanel.jsx"},{"name":"NextActionBar","sourcePath":"components/brand/NextActionBar.jsx"},{"name":"StageStrip","sourcePath":"components/brand/StageStrip.jsx"},{"name":"StatBlock","sourcePath":"components/brand/StatBlock.jsx"},{"name":"SummitLockup","sourcePath":"components/brand/SummitLockup.jsx"},{"name":"Tagline","sourcePath":"components/brand/Tagline.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"NavBar","sourcePath":"components/navigation/NavBar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"0684456d9309","components/brand/LogoPanel.jsx":"b66d7ca5adf0","components/brand/NextActionBar.jsx":"4e954eb6d9dd","components/brand/StageStrip.jsx":"f6a66494b307","components/brand/StatBlock.jsx":"00df9fe3188c","components/brand/SummitLockup.jsx":"687fbfe5fec1","components/brand/Tagline.jsx":"0c6379815a75","components/core/Badge.jsx":"5a23f87502df","components/core/Button.jsx":"43db4d4fc592","components/core/Card.jsx":"6001ac166b87","components/core/Eyebrow.jsx":"1e8817636819","components/core/Icon.jsx":"275578ae0cb0","components/core/IconButton.jsx":"7e3a5a97679c","components/feedback/Dialog.jsx":"aea496089c5a","components/feedback/Toast.jsx":"134984733d62","components/feedback/Tooltip.jsx":"2b335fc50e31","components/forms/Checkbox.jsx":"b09e0ca1e0d3","components/forms/Input.jsx":"c7c045ca6b91","components/forms/Radio.jsx":"c1d3c02d85b9","components/forms/Select.jsx":"770d9b9cd2b7","components/forms/Switch.jsx":"2003e235161e","components/navigation/NavBar.jsx":"55a8dea3a2ab","components/navigation/Tabs.jsx":"6f8dfaaa2e66","ui_kits/summit-partnership/Pages.jsx":"50f769247dd2"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.EdAIDesignSystem_c2118b = window.EdAIDesignSystem_c2118b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
function Logo({
  tone = "black",
  size = 48,
  base = "",
  style
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: `${base}assets/logo/edai-brandmark-${tone}.png`,
    alt: "EdAI",
    width: size,
    height: size,
    style: {
      display: "block",
      width: size,
      height: size,
      objectFit: "contain",
      ...style
    }
  });
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/brand/LogoPanel.jsx
try { (() => {
function LogoPanel({
  tone = "light",
  size = 56,
  base = "",
  style
}) {
  const dark = tone === "dark";
  const pad = Math.round(size * .45);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "inline-flex",
      padding: pad,
      background: dark ? "var(--black)" : "var(--cream-50)",
      borderRadius: "var(--radius-lg)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    tone: dark ? "white" : "black",
    size: size,
    base: base
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: pad * .6,
      bottom: 0,
      width: Math.max(24, size * .5),
      height: 3,
      background: "var(--brand-accent)",
      borderRadius: 2
    }
  }));
}
Object.assign(__ds_scope, { LogoPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/LogoPanel.jsx", error: String((e && e.message) || e) }); }

// components/brand/StageStrip.jsx
try { (() => {
const DEF = ["Discover", "Understand", "Build", "Test", "Present"];
function StageStrip({
  stages = DEF,
  active,
  tone = "dark",
  style
}) {
  const dark = tone === "dark";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${stages.length},minmax(0,1fr))`,
      gap: 8,
      ...style
    }
  }, stages.map((s, i) => {
    const on = active === undefined || i <= active;
    return /*#__PURE__*/React.createElement("div", {
      key: s,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 3,
        borderRadius: 2,
        background: on ? "var(--brand-accent)" : dark ? "var(--ink-700)" : "var(--ink-100)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: ".12em",
        color: dark ? "var(--ink-300)" : "var(--ink-500)"
      }
    }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 16,
        fontWeight: 500,
        color: dark ? "var(--white)" : "var(--black)"
      }
    }, s));
  }));
}
Object.assign(__ds_scope, { StageStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/StageStrip.jsx", error: String((e && e.message) || e) }); }

// components/brand/StatBlock.jsx
try { (() => {
function StatBlock({
  value,
  label,
  tone = "dark",
  accent,
  style
}) {
  const dark = tone === "dark";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif-display)",
      fontSize: 40,
      lineHeight: 1.05,
      color: accent ? "var(--emerald-400)" : dark ? "var(--white)" : "var(--black)"
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: dark ? "var(--ink-300)" : "var(--ink-500)"
    }
  }, label));
}
Object.assign(__ds_scope, { StatBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/StatBlock.jsx", error: String((e && e.message) || e) }); }

// components/brand/SummitLockup.jsx
try { (() => {
function SummitLockup({
  layout = "stacked",
  tone = "black",
  size = 72,
  base = "",
  style
}) {
  const row = layout === "horizontal";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      flexDirection: row ? "row" : "column",
      alignItems: "center",
      gap: row ? size * .3 : size * .2,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    tone: tone,
    size: size,
    base: base
  }), row && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      alignSelf: "stretch",
      background: tone === "white" ? "var(--ink-600)" : "var(--ink-200)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 500,
      fontSize: Math.max(12, size * .22),
      letterSpacing: "var(--tracking-lockup)",
      textTransform: "uppercase",
      color: tone === "white" ? "var(--white)" : "var(--black)",
      whiteSpace: "nowrap"
    }
  }, "Summer Summit"));
}
Object.assign(__ds_scope, { SummitLockup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/SummitLockup.jsx", error: String((e && e.message) || e) }); }

// components/brand/Tagline.jsx
try { (() => {
function Tagline({
  color,
  size = 14,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: size,
      fontWeight: 500,
      letterSpacing: "var(--tracking-tagline)",
      textAlign: "center",
      color: color || "currentColor",
      ...style
    }
  }, "Raising Muslim Teens as Builders and Founders");
}
Object.assign(__ds_scope, { Tagline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Tagline.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const T = {
  accent: ["var(--emerald-50)", "var(--emerald-700)"],
  neutral: ["var(--cream-200)", "var(--ink-600)"],
  dark: ["var(--ink-800)", "var(--white)"],
  solid: ["var(--brand-accent)", "var(--white)"],
  warning: ["var(--status-warning-bg)", "#8A5A00"],
  danger: ["var(--status-danger-bg)", "#8E2B1E"]
};
function Badge({
  tone = "accent",
  children,
  dot,
  style
}) {
  const [bg, fg] = T[tone] || T.accent;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 24,
      padding: "0 10px",
      borderRadius: "var(--radius-pill)",
      background: bg,
      color: fg,
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: ".02em",
      whiteSpace: "nowrap",
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: "currentColor"
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  tone = "light",
  padding = 24,
  accentRule,
  interactive,
  children,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const dark = tone === "dark";
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false)
  }, rest, {
    style: {
      position: "relative",
      background: dark ? "var(--surface-dark-card)" : tone === "cream" ? "var(--cream-50)" : "var(--surface-card)",
      color: dark ? "var(--text-on-dark)" : "var(--text-primary)",
      border: `1px solid ${dark ? "var(--border-dark)" : "var(--border-subtle)"}`,
      borderRadius: "var(--radius-lg)",
      padding,
      boxShadow: interactive && h ? "var(--shadow-md)" : "none",
      transform: interactive && h ? "translateY(-2px)" : "none",
      transition: "box-shadow var(--dur-base),transform var(--dur-base)",
      cursor: interactive ? "pointer" : undefined,
      ...style
    }
  }), accentRule && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: padding,
      bottom: 0,
      width: "var(--rule-accent-w)",
      height: "var(--rule-accent-h)",
      background: "var(--brand-accent)",
      borderRadius: 2
    }
  }), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function Eyebrow({
  children,
  color = "var(--text-accent)",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-eyebrow)",
      fontWeight: 600,
      letterSpacing: "var(--tracking-eyebrow)",
      textTransform: "uppercase",
      color,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Icon({
  name,
  size = 18,
  color = "currentColor",
  style,
  ...rest
}) {
  const url = `https://unpkg.com/lucide-static@0.460.0/icons/${name}.svg`;
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true"
  }, rest, {
    style: {
      display: "inline-block",
      flex: "none",
      width: size,
      height: size,
      background: color,
      WebkitMask: `url(${url}) center/contain no-repeat`,
      mask: `url(${url}) center/contain no-repeat`,
      ...style
    }
  }));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SZ = {
  sm: {
    h: 36,
    px: 14,
    fs: 14
  },
  md: {
    h: 44,
    px: 20,
    fs: 15
  },
  lg: {
    h: 52,
    px: 26,
    fs: 16
  }
};
function Button({
  variant = "primary",
  size = "md",
  tone = "light",
  icon,
  iconRight,
  disabled,
  fullWidth,
  children,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false),
    [p, setP] = React.useState(false);
  const s = SZ[size] || SZ.md;
  const dark = tone === "dark";
  const V = {
    primary: {
      bg: p ? "var(--brand-accent-press)" : h ? "var(--brand-accent-hover)" : "var(--brand-accent)",
      fg: "var(--text-on-accent)",
      bd: "transparent"
    },
    secondary: {
      bg: dark ? h ? "var(--white)" : "var(--cream-100)" : h ? "var(--ink-800)" : "var(--black)",
      fg: dark ? "var(--black)" : "var(--white)",
      bd: "transparent"
    },
    outline: {
      bg: h ? dark ? "rgba(255,255,255,.06)" : "rgba(11,11,10,.04)" : "transparent",
      fg: dark ? "var(--white)" : "var(--black)",
      bd: dark ? "var(--ink-600)" : "var(--border-strong)"
    },
    ghost: {
      bg: h ? dark ? "rgba(255,255,255,.08)" : "rgba(11,11,10,.05)" : "transparent",
      fg: dark ? "var(--white)" : "var(--black)",
      bd: "transparent"
    }
  }[variant] || {};
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onMouseDown: () => setP(true),
    onMouseUp: () => setP(false)
  }, rest, {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      whiteSpace: "nowrap",
      flex: "none",
      height: s.h,
      padding: `0 ${s.px}px`,
      width: fullWidth ? "100%" : undefined,
      fontFamily: "var(--font-sans)",
      fontSize: s.fs,
      fontWeight: 500,
      letterSpacing: ".01em",
      borderRadius: "var(--radius-pill)",
      border: `1px solid ${V.bd}`,
      background: V.bg,
      color: V.fg,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? .4 : 1,
      transform: p && !disabled ? "scale(.98)" : "none",
      transition: "background var(--dur-fast) var(--ease-standard),transform var(--dur-fast)",
      ...style
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.fs + 2
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.fs + 2
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/brand/NextActionBar.jsx
try { (() => {
function NextActionBar({
  label = "Next step",
  action,
  owner,
  deadline,
  cta,
  onCta,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 24,
      padding: "20px 24px",
      background: "var(--brand-accent)",
      color: "var(--white)",
      borderRadius: "var(--radius-lg)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: ".14em",
      textTransform: "uppercase",
      opacity: .85
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 500,
      marginTop: 4
    }
  }, action), (owner || deadline) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      marginTop: 6
    }
  }, owner && /*#__PURE__*/React.createElement("span", null, "Owner: ", owner), owner && deadline && /*#__PURE__*/React.createElement("span", null, " \xB7 "), deadline && /*#__PURE__*/React.createElement("span", null, "By ", deadline))), cta && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "sm",
    onClick: onCta
  }, cta));
}
Object.assign(__ds_scope, { NextActionBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/NextActionBar.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  variant = "outline",
  tone = "light",
  size = 40,
  style,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const dark = tone === "dark";
  const bg = variant === "primary" ? h ? "var(--brand-accent-hover)" : "var(--brand-accent)" : h ? dark ? "rgba(255,255,255,.08)" : "rgba(11,11,10,.05)" : "transparent";
  const fg = variant === "primary" ? "var(--white)" : dark ? "var(--white)" : "var(--black)";
  const bd = variant === "outline" ? dark ? "var(--ink-600)" : "var(--border-strong)" : "transparent";
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false)
  }, rest, {
    style: {
      width: size,
      height: size,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-pill)",
      border: `1px solid ${bd}`,
      background: bg,
      color: fg,
      cursor: "pointer",
      transition: "background var(--dur-fast)",
      ...style
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * .45)
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(11,11,10,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: width,
      background: "var(--white)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-lg)",
      padding: 32,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "Close",
    variant: "ghost",
    size: 36,
    onClick: onClose,
    style: {
      position: "absolute",
      top: 16,
      right: 16
    }
  }), title && /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 40px 12px 0",
      fontFamily: "var(--font-serif-display)",
      fontWeight: 400,
      fontSize: 24,
      lineHeight: 1.25
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      lineHeight: 1.55,
      color: "var(--ink-600)"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "flex-end",
      marginTop: 28
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const I = {
  success: "check-circle-2",
  info: "info",
  warning: "alert-triangle",
  danger: "alert-octagon"
};
const C = {
  success: "var(--emerald-400)",
  info: "var(--ink-300)",
  warning: "var(--amber-500)",
  danger: "#E4735F"
};
function Toast({
  tone = "success",
  title,
  children,
  onClose,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      width: 360,
      boxSizing: "border-box",
      padding: "14px 16px",
      background: "var(--ink-900)",
      color: "var(--white)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-lg)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: I[tone],
    size: 18,
    color: C[tone],
    style: {
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink-300)",
      marginTop: 2,
      lineHeight: 1.45
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("span", {
    onClick: onClose,
    style: {
      cursor: "pointer",
      color: "var(--ink-300)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 16
  })));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  content,
  children,
  placement = "top"
}) {
  const [o, setO] = React.useState(false);
  const pos = placement === "bottom" ? {
    top: "calc(100% + 8px)"
  } : {
    bottom: "calc(100% + 8px)"
  };
  return /*#__PURE__*/React.createElement("span", {
    onMouseEnter: () => setO(true),
    onMouseLeave: () => setO(false),
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, children, o && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      ...pos,
      background: "var(--black)",
      color: "var(--white)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      lineHeight: 1.4,
      padding: "6px 10px",
      borderRadius: "var(--radius-sm)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      zIndex: 10
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled,
  style
}) {
  const [c, setC] = React.useState(!!defaultChecked);
  const on = checked !== undefined ? checked : c;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      color: "var(--text-primary)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? .45 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => {
      if (disabled) return;
      setC(!on);
      onChange && onChange(!on);
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: on ? "var(--brand-accent)" : "var(--white)",
      border: `1.5px solid ${on ? "var(--brand-accent)" : "var(--ink-300)"}`,
      transition: "background var(--dur-fast)"
    }
  }, on && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 6.2l2.3 2.3 4.7-5",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const lab = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  display: "block",
  marginBottom: 6
};
const hintS = e => ({
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  color: e ? "var(--status-danger)" : "var(--text-muted)",
  marginTop: 6
});
const box = (f, e, d) => ({
  width: "100%",
  boxSizing: "border-box",
  height: 44,
  padding: "0 14px",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--text-primary)",
  background: d ? "var(--cream-200)" : "var(--white)",
  border: `1px solid ${e ? "var(--status-danger)" : f ? "var(--brand-accent)" : "var(--border-strong)"}`,
  borderRadius: "var(--radius-md)",
  outline: "none",
  boxShadow: f ? "0 0 0 3px var(--focus-ring)" : "none",
  transition: "border-color var(--dur-fast),box-shadow var(--dur-fast)"
});
function Input({
  label,
  hint,
  error,
  disabled,
  style,
  ...rest
}) {
  const [f, setF] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: lab
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    disabled: disabled,
    onFocus: () => setF(true),
    onBlur: () => setF(false)
  }, rest, {
    style: box(f, error, disabled)
  })), (error || hint) && /*#__PURE__*/React.createElement("div", {
    style: hintS(error)
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  options = [],
  value,
  defaultValue,
  onChange,
  name,
  direction = "column",
  style
}) {
  const [v, setV] = React.useState(defaultValue);
  const cur = value !== undefined ? value : v;
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    style: {
      display: "flex",
      flexDirection: direction,
      gap: direction === "row" ? 20 : 12,
      ...style
    }
  }, options.map(o => {
    const val = typeof o === "string" ? o : o.value,
      lab = typeof o === "string" ? o : o.label,
      on = cur === val;
    return /*#__PURE__*/React.createElement("label", {
      key: val,
      onClick: () => {
        setV(val);
        onChange && onChange(val);
      },
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 20,
        height: 20,
        borderRadius: 10,
        flex: "none",
        boxSizing: "border-box",
        border: `1.5px solid ${on ? "var(--brand-accent)" : "var(--ink-300)"}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--white)"
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 5,
        background: "var(--brand-accent)"
      }
    })), lab);
  }));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const lab = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  display: "block",
  marginBottom: 6
};
const hintS = e => ({
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  color: e ? "var(--status-danger)" : "var(--text-muted)",
  marginTop: 6
});
const box = (f, e, d) => ({
  width: "100%",
  boxSizing: "border-box",
  height: 44,
  padding: "0 14px",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--text-primary)",
  background: d ? "var(--cream-200)" : "var(--white)",
  border: `1px solid ${e ? "var(--status-danger)" : f ? "var(--brand-accent)" : "var(--border-strong)"}`,
  borderRadius: "var(--radius-md)",
  outline: "none",
  boxShadow: f ? "0 0 0 3px var(--focus-ring)" : "none",
  transition: "border-color var(--dur-fast),box-shadow var(--dur-fast)"
});
function Select({
  label,
  hint,
  error,
  options = [],
  disabled,
  style,
  ...rest
}) {
  const [f, setF] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: lab
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    disabled: disabled,
    onFocus: () => setF(true),
    onBlur: () => setF(false)
  }, rest, {
    style: {
      ...box(f, error, disabled),
      appearance: "none",
      paddingRight: 40,
      cursor: "pointer"
    }
  }), options.map(o => typeof o === "string" ? /*#__PURE__*/React.createElement("option", {
    key: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16,
    color: "var(--ink-500)",
    style: {
      position: "absolute",
      right: 14,
      top: 14,
      pointerEvents: "none"
    }
  })), (error || hint) && /*#__PURE__*/React.createElement("div", {
    style: hintS(error)
  }, error || hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled,
  style
}) {
  const [c, setC] = React.useState(!!defaultChecked);
  const on = checked !== undefined ? checked : c;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? .45 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => {
      if (disabled) return;
      setC(!on);
      onChange && onChange(!on);
    },
    style: {
      width: 40,
      height: 24,
      borderRadius: 12,
      flex: "none",
      position: "relative",
      background: on ? "var(--brand-accent)" : "var(--ink-200)",
      transition: "background var(--dur-base)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: on ? 19 : 3,
      width: 18,
      height: 18,
      borderRadius: 9,
      background: "var(--white)",
      boxShadow: "var(--shadow-sm)",
      transition: "left var(--dur-base) var(--ease-standard)"
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavBar.jsx
try { (() => {
function NavBar({
  links = [],
  active,
  cta = "Register",
  onCta,
  onNav,
  tone = "light",
  logoBase = "",
  style
}) {
  const dark = tone === "dark";
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
      height: 72,
      padding: "0 32px",
      background: dark ? "var(--black)" : "var(--cream-100)",
      borderBottom: `1px solid ${dark ? "var(--border-dark)" : "var(--border-subtle)"}`,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    tone: dark ? "white" : "black",
    size: 36,
    base: logoBase
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 28
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    onClick: () => onNav && onNav(l),
    style: {
      cursor: "pointer",
      textDecoration: "none",
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: active === l ? 600 : 400,
      color: active === l ? dark ? "var(--white)" : "var(--black)" : dark ? "var(--ink-300)" : "var(--ink-500)"
    }
  }, l))), cta && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    onClick: onCta
  }, cta));
}
Object.assign(__ds_scope, { NavBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  tone = "light",
  style
}) {
  const [v, setV] = React.useState(defaultValue ?? (tabs[0] && (tabs[0].value ?? tabs[0])));
  const cur = value !== undefined ? value : v;
  const dark = tone === "dark";
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "flex",
      gap: 28,
      borderBottom: `1px solid ${dark ? "var(--border-dark)" : "var(--border-subtle)"}`,
      ...style
    }
  }, tabs.map(t => {
    const val = t.value ?? t,
      lab = t.label ?? t,
      on = val === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      role: "tab",
      "aria-selected": on,
      onClick: () => {
        setV(val);
        onChange && onChange(val);
      },
      style: {
        background: "none",
        border: "none",
        padding: "0 0 12px",
        marginBottom: -1,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        fontWeight: on ? 600 : 400,
        color: on ? dark ? "var(--white)" : "var(--black)" : dark ? "var(--ink-300)" : "var(--ink-500)",
        borderBottom: `2px solid ${on ? "var(--brand-accent)" : "transparent"}`,
        transition: "color var(--dur-fast)"
      }
    }, lab);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/summit-partnership/Pages.jsx
try { (() => {
const {
  Logo,
  Eyebrow,
  StatBlock,
  StageStrip,
  NextActionBar,
  Tagline,
  Card,
  Badge,
  Button,
  Icon
} = window.EdAIDesignSystem_c2118b;
const B = "../../";
const pageS = {
  width: 816,
  height: 1056,
  background: "var(--black)",
  color: "var(--white)",
  position: "relative",
  boxSizing: "border-box",
  padding: "56px 64px",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-sans)",
  overflow: "hidden",
  flex: "none"
};
const h1S = {
  fontFamily: "var(--font-serif-display)",
  fontWeight: 400,
  fontSize: 52,
  lineHeight: 1.08,
  letterSpacing: "-.01em",
  margin: "18px 0 0",
  textWrap: "pretty"
};
const h2S = {
  fontFamily: "var(--font-serif-display)",
  fontWeight: 400,
  fontSize: 36,
  lineHeight: 1.15,
  margin: "14px 0 0",
  textWrap: "pretty"
};
const pS = {
  fontSize: 16,
  lineHeight: 1.6,
  color: "var(--ink-300)",
  margin: 0,
  textWrap: "pretty"
};
function Footer({
  n
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 20,
      borderTop: "1px solid var(--ink-700)",
      fontSize: 12,
      color: "var(--ink-400)",
      letterSpacing: ".04em",
      whiteSpace: "nowrap",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", null, "EdAI Venture Studio \xB7 edai.fun"), /*#__PURE__*/React.createElement("span", null, "EdAI Seattle Summit 2026"), /*#__PURE__*/React.createElement("span", null, String(n).padStart(2, "0")));
}
function Cover({
  recipient
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: pageS,
    "data-screen-label": "01 Cover"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    tone: "white",
    size: 72,
    base: B
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: "dark"
  }, "Partnership invitation")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 120
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--emerald-400)"
  }, "August 29\u201330, 2026 \xB7 University of Washington, Seattle"), /*#__PURE__*/React.createElement("h1", {
    style: h1S
  }, recipient, " \xD7 EdAI"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...pS,
      fontSize: 19,
      marginTop: 20,
      maxWidth: 560,
      color: "var(--ink-200)"
    }
  }, "An invitation to help young people move from consuming technology to creating value with it.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 20,
      marginTop: 72,
      paddingTop: 28,
      borderTop: "1px solid var(--ink-700)"
    }
  }, /*#__PURE__*/React.createElement(StatBlock, {
    value: "2",
    label: "Full build days"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    value: "100\u2013200",
    label: "Student goal"
  }), /*#__PURE__*/React.createElement(StatBlock, {
    value: "$3,500",
    label: "Prize pool",
    accent: true
  }), /*#__PURE__*/React.createElement(StatBlock, {
    value: "3",
    label: "Meals per day"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement(Tagline, {
    color: "var(--emerald-400)"
  })));
}
function Why({
  recipient
}) {
  const items = [["users", "Community impact", "Muslim high-school students build a working product with AI in two days."], ["handshake", "Direct access", "Students, parents, founders, engineers and mentors in one room."], ["badge-check", "Trusted visibility", "Recognition across signage, program materials and the recap video."], ["sprout", "Long-term relationship", "A pathway into future EdAI programs and city events."]];
  return /*#__PURE__*/React.createElement("div", {
    style: pageS,
    "data-screen-label": "02 Why it matters"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--emerald-400)"
  }, "Why this partnership matters"), /*#__PURE__*/React.createElement("h2", {
    style: h2S
  }, "From consuming technology to building with it."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginTop: 36
    }
  }, items.map(([i, t, d]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    tone: "dark",
    accentRule: true,
    padding: 24
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i,
    size: 22,
    color: "var(--emerald-400)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 500,
      marginTop: 14
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      ...pS,
      fontSize: 14,
      marginTop: 6
    }
  }, d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 36
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--ink-300)"
  }, "The student journey"), /*#__PURE__*/React.createElement(StageStrip, {
    style: {
      marginTop: 16
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 36,
      padding: 24,
      borderRadius: 16,
      background: "var(--ink-900)",
      border: "1px solid var(--emerald-800)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif-display)",
      fontSize: 22
    }
  }, "Why this matters for ", recipient), /*#__PURE__*/React.createElement("p", {
    style: {
      ...pS,
      marginTop: 10
    }
  }, "[Two or three specific sentences connecting ", recipient, "'s mission, community and values to EdAI \u2014 personalised per recipient.]")), /*#__PURE__*/React.createElement(Footer, {
    n: 2
  }));
}
function Ways() {
  const C = ({
    tag,
    title,
    items,
    dark
  }) => /*#__PURE__*/React.createElement(Card, {
    tone: dark ? "cream" : "dark",
    padding: 28,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: dark ? "solid" : "dark"
  }, tag), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-serif-display)",
      fontSize: 26,
      lineHeight: 1.2
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10,
      marginTop: 4
    }
  }, items.map(x => /*#__PURE__*/React.createElement("div", {
    key: x,
    style: {
      display: "flex",
      gap: 10,
      fontSize: 15,
      lineHeight: 1.45,
      color: dark ? "var(--ink-600)" : "var(--ink-200)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    color: "var(--emerald-500)",
    style: {
      marginTop: 3
    }
  }), x))));
  return /*#__PURE__*/React.createElement("div", {
    style: pageS,
    "data-screen-label": "03 Two ways to partner"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--emerald-400)"
  }, "Two ways to partner"), /*#__PURE__*/React.createElement("h2", {
    style: h2S
  }, "Partnership is possible without funding."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...pS,
      marginTop: 14,
      maxWidth: 600
    }
  }, "Sponsorship is a natural way to deepen the impact. Many partners do both."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginTop: 36
    }
  }, /*#__PURE__*/React.createElement(C, {
    tag: "No cost",
    title: "Community Partner",
    items: ["Share the Summit on your channels", "Display the flyer", "One email or WhatsApp share to your list", "Nominate students, introduce mentors"]
  }), /*#__PURE__*/React.createElement(C, {
    dark: true,
    tag: "Cash or in-kind",
    title: "Sponsoring Partner",
    items: ["Fund scholarships for students", "Cover tooling, hosting and AI credits", "Meals, materials and prizes", "Recognition by sponsorship level"]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      padding: "18px 22px",
      borderRadius: 16,
      border: "1px dashed var(--ink-600)",
      fontSize: 15,
      color: "var(--ink-200)"
    }
  }, "Join as a Community Partner and strengthen the impact through sponsorship."), /*#__PURE__*/React.createElement(Footer, {
    n: 3
  }));
}
const TIERS = [["Friend", 500, "Logo on venue signage; named in the event recap; thank-you post on EdAI socials"], ["Supporter", 1000, "Logo on program materials; included in community email & WhatsApp announcements"], ["Builder", 2500, "Dedicated partner post; table at the venue if an exhibitor area runs; logo in the recap video"], ["Innovator", 5000, "Speaking slot to the full cohort; judge seat at final pitches; named prize or award"], ["Title Partner", 10000, "“Presented by” naming; top billing on all assets & stage backdrop; carried into every EdAI city event for the year"]];
function Levels({
  sel,
  setSel
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: pageS,
    "data-screen-label": "04 Sponsorship levels"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--emerald-400)"
  }, "Sponsorship opportunities"), /*#__PURE__*/React.createElement("h2", {
    style: h2S
  }, "Every level includes everything below it."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10,
      marginTop: 32
    }
  }, TIERS.map(([n, a, d]) => {
    const on = sel === n;
    return /*#__PURE__*/React.createElement("div", {
      key: n,
      onClick: () => setSel(n),
      style: {
        display: "grid",
        gridTemplateColumns: "150px 110px 1fr",
        gap: 20,
        alignItems: "center",
        padding: "18px 22px",
        borderRadius: 16,
        cursor: "pointer",
        background: on ? "var(--emerald-900)" : "var(--ink-900)",
        border: `1px solid ${on ? "var(--emerald-500)" : "var(--ink-700)"}`,
        transition: "background var(--dur-base),border-color var(--dur-base)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 500
      }
    }, n), n === "Builder" && /*#__PURE__*/React.createElement(Badge, {
      tone: "solid",
      style: {
        alignSelf: "flex-start"
      }
    }, "Most popular"), n === "Title Partner" && /*#__PURE__*/React.createElement(Badge, {
      tone: "dark",
      style: {
        alignSelf: "flex-start"
      }
    }, "Maximum impact")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-serif-display)",
        fontSize: 26,
        color: on ? "var(--emerald-300)" : "var(--white)"
      }
    }, "$", a.toLocaleString()), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--ink-300)"
      }
    }, d));
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      ...pS,
      fontSize: 13,
      marginTop: 20
    }
  }, "Cash, in-kind (food, venue, hardware, prizes) or a mix. In-kind counts at retail value. Click a level to set the recommendation."), /*#__PURE__*/React.createElement(Footer, {
    n: 4
  }));
}
function Next({
  recipient,
  sel
}) {
  const t = TIERS.find(x => x[0] === sel);
  return /*#__PURE__*/React.createElement("div", {
    style: pageS,
    "data-screen-label": "05 Next step"
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--emerald-400)"
  }, "Our proposed partnership"), /*#__PURE__*/React.createElement("h2", {
    style: h2S
  }, recipient, " as a Community Partner and ", sel, " sponsor."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginTop: 36
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tone: "dark",
    padding: 24
  }, /*#__PURE__*/React.createElement(StatBlock, {
    value: "$" + t[1].toLocaleString(),
    label: sel + " level",
    accent: true
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      ...pS,
      fontSize: 14,
      marginTop: 14
    }
  }, t[2])), /*#__PURE__*/React.createElement(Card, {
    tone: "dark",
    padding: 24
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "var(--ink-300)"
  }, "What sponsorship pays for"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10,
      marginTop: 14,
      fontSize: 15
    }
  }, [["Scholarships", "seats for students who can't cover tuition"], ["The build", "tooling, hosting, AI credits"], ["The room", "food, materials, prizes"], ["The record", "videography to share"]].map(([a, b]) => /*#__PURE__*/React.createElement("div", {
    key: a
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 500
    }
  }, a), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ink-300)"
    }
  }, "\u2014 ", b)))))), /*#__PURE__*/React.createElement(NextActionBar, {
    style: {
      marginTop: 36
    },
    action: 'Reply “Yes, let’s partner”',
    owner: recipient,
    deadline: "[decision date]",
    cta: "Reply yes"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      display: "flex",
      gap: 32,
      fontSize: 15,
      color: "var(--ink-200)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user",
    size: 16,
    color: "var(--emerald-400)"
  }), "Azeez Idris, PhD"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mail",
    size: 16,
    color: "var(--emerald-400)"
  }), "aidris@edai.fun"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 16,
    color: "var(--emerald-400)"
  }), "515-357-0454")), /*#__PURE__*/React.createElement(Footer, {
    n: 5
  }));
}
Object.assign(window, {
  Cover,
  Why,
  Ways,
  Levels,
  Next
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/summit-partnership/Pages.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.LogoPanel = __ds_scope.LogoPanel;

__ds_ns.NextActionBar = __ds_scope.NextActionBar;

__ds_ns.StageStrip = __ds_scope.StageStrip;

__ds_ns.StatBlock = __ds_scope.StatBlock;

__ds_ns.SummitLockup = __ds_scope.SummitLockup;

__ds_ns.Tagline = __ds_scope.Tagline;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.NavBar = __ds_scope.NavBar;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
