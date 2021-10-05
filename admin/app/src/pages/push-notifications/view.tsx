import { Typography } from '@material-ui/core';
import React, { ReactElement } from 'react';

import NotificationLayout from '../../components/navigation/InnerLayouts/notificationLayout';
import {
  // useAppDispatch,
  useAppSelector,
} from '../../redux/store';

const View = () => {
  // const dispatch = useAppDispatch();
  //
  // const [selected, setSelected] = useState(0);
  // const [moduleDisabled, setModuleDisabled] = useState(false);
  const {
    // config,
    notifications,
  } = useAppSelector((state) => state.notificationsSlice.data);

  // useEffect(() => {
  //   if (config) {
  //     if (config.message !== '') {
  //       setModuleDisabled(true);
  //     } else {
  //       setModuleDisabled(false);
  //       setSelected(0);
  //     }
  //   }
  // }, [config]);
  return notifications ? (
    <></>
  ) : (
    // <DataTable dsData={notifications} />
    <Typography variant={'h6'}>No data available</Typography>
  );
};

View.getLayout = function getLayout(page: ReactElement) {
  return <NotificationLayout>{page}</NotificationLayout>;
};

export default View;
