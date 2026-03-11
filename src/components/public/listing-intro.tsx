interface Props {
  categoryName?: string;
  cityName: string;
  state: string;
  count: number;
}

export function ListingIntro({ categoryName, cityName, state, count }: Props) {
  const subject = categoryName ?? 'estabelecimentos';

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-3">
        {categoryName ? `${categoryName} em ${cityName}, ${state}` : `Comércios em ${cityName}, ${state}`}
      </h1>
      <p className="text-gray-600 max-w-2xl">
        Encontre {subject.toLowerCase()} em {cityName}, {state}.
        Veja cardápios, horários de funcionamento e formas de atendimento —
        entrega, consumo no local ou retirada.
        {count > 0 && ` ${count} estabelecimento${count !== 1 ? 's' : ''} cadastrado${count !== 1 ? 's' : ''}.`}
      </p>
    </div>
  );
}
