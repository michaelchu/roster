import { Outlet } from 'react-router-dom';
import { EventDetailPage } from './EventDetailPage';

export function EventDetailLayout() {
  return (
    <>
      <EventDetailPage />
      <Outlet />
    </>
  );
}
