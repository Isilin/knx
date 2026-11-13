import { useFollowed } from "../hooks/useFollowed.ts";
import "./FollowButton.css";

/** Star toggle: followed companies stay in full ink across charts and tables. */
export function FollowButton({
  slug,
  name,
  compact = false,
}: {
  slug: string;
  name: string;
  compact?: boolean;
}) {
  const { isFollowed, toggle } = useFollowed();
  const on = isFollowed(slug);
  return (
    <button
      type="button"
      className={`follow${compact ? " follow--compact" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Ne plus suivre ${name}` : `Suivre ${name}`}
      title={on ? "Ne plus suivre" : "Suivre"}
      onClick={() => toggle(slug)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M8 1.6 9.9 5.7l4.4.5-3.3 3 .9 4.4L8 11.4l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" />
      </svg>
      {compact ? null : <span>{on ? "Suivie" : "Suivre"}</span>}
    </button>
  );
}
