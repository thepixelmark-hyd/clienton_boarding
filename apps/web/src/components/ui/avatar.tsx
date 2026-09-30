import { cn, initials } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function Avatar({
  name,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // Avatars come from arbitrary client-provided/uploaded URLs — next/image
      // requires allowlisting every source domain, which doesn't fit this use case.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={cn("rounded-full object-cover", SIZE_CLASSES[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-accent/10 font-medium text-accent",
        SIZE_CLASSES[size],
        className,
      )}
      title={name}
      aria-hidden={false}
    >
      {initials(name)}
    </div>
  );
}

export function AvatarGroup({ people, max = 4 }: { people: { name: string; imageUrl?: string | null }[]; max?: number }) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((p, i) => (
        <Avatar key={i} name={p.name} imageUrl={p.imageUrl} size="sm" className="ring-2 ring-surface" />
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-medium text-text-secondary ring-2 ring-surface">
          +{overflow}
        </div>
      )}
    </div>
  );
}
