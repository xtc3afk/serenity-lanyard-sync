import { createFileRoute } from '@tanstack/react-router';
import { HealthCheckPage } from '@/components/site/HealthCheckPage';

export const Route = createFileRoute('/status')({
  component: HealthCheckPage,
});