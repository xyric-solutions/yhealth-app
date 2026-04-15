import ObstacleDiagnosisContent from './ObstacleDiagnosisContent';

export default async function ObstacleDiagnosisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ObstacleDiagnosisContent obstacleId={id} />;
}
