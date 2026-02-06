const KpiCard = ({ title, value, subtitle }) => {
  return (
    <div
  className="
    relative rounded-2xl p-6
    bg-white/[0.07]
    backdrop-blur-lg
    border border-white/15

    shadow-[0_0_25px_rgba(79,195,247,0.12)]
    hover:shadow-[0_0_55px_rgba(79,195,247,0.45)]

    transition-all duration-300
  "
>

      <p className="text-sm text-white/60">
        {title}
      </p>

      <h3 className="mt-2 text-3xl font-semibold text-white">
        {value}
      </h3>

      {subtitle && (
        <span className="mt-1 block text-sm text-emerald-400">
          {subtitle}
        </span>
      )}
    </div>
  );
};

export default KpiCard;
