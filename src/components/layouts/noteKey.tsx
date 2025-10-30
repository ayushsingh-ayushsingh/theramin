
interface NoteKeyProps {
  className?: string;
  orientation?: "default" | "flipped" | "plain";
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function NoteKey({
  orientation = "default",
  className = "h-screen bg-red-950",
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  onClick,
}: NoteKeyProps) {
  return (
    <div
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onClick={onClick}
    >
      {orientation === "default" && (
        <div className="h-screen grid grid-cols-2">
          <div className="bg-red-600"></div>
          <div className="bg-red-600"></div>
        </div>
      )}
      {orientation === "flipped" && (
        <div className="h-screen grid grid-cols-2">
          <div className="bg-red-950"></div>
          <div className="bg-red-950"></div>
        </div>
      )}
      {orientation === "plain" && (
        <div className="h-screen grid grid-cols-2">
          <div className="bg-red-600"></div>
          <div className="bg-red-600 border-r border-red-950/50"></div>
        </div>
      )}
    </div>
  );
}