interface EqualizerProps {
  active: boolean;
}

export function Equalizer({ active }: EqualizerProps) {
  return (
    <div data-paused={!active} aria-hidden="true">
      <div className="eq">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}