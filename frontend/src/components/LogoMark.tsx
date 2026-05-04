type Props = {
  /** Edge length in px. */
  size?: number;
  /** Inverted variant for use on dark backgrounds. */
  dark?: boolean;
  className?: string;
};

/**
 * SealPad — "Cipher Block" mark.
 *
 *   Outer  · obsidian container         (the sealed envelope)
 *   Middle · contrasting aperture       (the unsealed window)
 *   Inner  · Saturn-orange seal point   (the encrypted key)
 *
 * Three nested squares, each with the 0.69px Sealed-Geometry kiss.
 * Pairs with the wordmark "SEALPAD" rendered in Inter / Work Sans Bold.
 */
export function LogoMark({ size = 36, dark = false, className }: Props) {
  // Proportions — 64u outer / 36u middle / 12u inner.
  const mid = Math.round(size * 0.5625); // 36/64
  const inner = Math.round(size * 0.1875); // 12/64

  const outerBg = dark ? "#FFFFFF" : "#181818";
  const midBg = dark ? "#181818" : "#FFFFFF";

  // Centered offsets for absolutely-positioned children
  const midOffset = (size - mid) / 2;
  const innerOffset = (size - inner) / 2;

  return (
    <div
      className={`relative shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: outerBg,
        borderRadius: "0.69px",
      }}
      aria-label="SealPad"
      role="img"
    >
      {/* Middle aperture */}
      <div
        className="absolute"
        style={{
          left: midOffset,
          top: midOffset,
          width: mid,
          height: mid,
          backgroundColor: midBg,
          borderRadius: "0.69px",
        }}
      />
      {/* Inner orange seal */}
      <div
        className="absolute bg-brand-500"
        style={{
          left: innerOffset,
          top: innerOffset,
          width: inner,
          height: inner,
          borderRadius: "0.69px",
        }}
      />
    </div>
  );
}
