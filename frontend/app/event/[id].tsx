/**
 * Event redirect - routes /event/[id] to /evento/[id]
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EventRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/evento/${id}` as any} />;
}
