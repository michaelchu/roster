import { Outlet } from 'react-router-dom';
import { GroupDetailPage } from './GroupDetailPage';

export function GroupDetailLayout() {
  return (
    <>
      <GroupDetailPage />
      <Outlet />
    </>
  );
}
