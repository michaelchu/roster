import { Outlet } from 'react-router-dom';
import { EventsPage } from './EventsPage';

export function EventsLayout() {
  return (
    <>
      <EventsPage />
      <Outlet />
    </>
  );
}
