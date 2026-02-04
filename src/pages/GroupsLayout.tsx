import { Outlet } from 'react-router-dom';
import { GroupsPage } from './GroupsPage';

export function GroupsLayout() {
  return (
    <>
      <GroupsPage />
      <Outlet />
    </>
  );
}
