import React from 'react';
import { Home } from '@material-ui/icons';
import { getModuleIcon, handleModuleNavigation } from './moduleUtils';
import { useRouter } from 'next/router';
import { useAppDispatch } from '../../redux/store';
import { enqueueInfoNotification } from '../../utils/useNotifier';
import CustomListItem from '../navigation/CustomListItem';

interface IModule {
  moduleName: string;
  url: string;
}

interface Props {
  modules: IModule[];
  itemSelected?: string;
  homeEnabled?: boolean;
}

const Modules: React.FC<Props> = ({ modules, homeEnabled, itemSelected }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const handleItemClick = (url: string, enabled: boolean) => {
    if (enabled) {
      router.replace(url);
      return;
    }
    dispatch(enqueueInfoNotification('Module currently disabled.'));
  };

  return (
    <>
      {homeEnabled ? (
        <CustomListItem
          selected={itemSelected === ''}
          icon={<Home color={'inherit'} />}
          title="home"
          onClick={() => handleItemClick('/', true)}
        />
      ) : (
        <></>
      )}
      {modules &&
        modules.map((module, index) => {
          const currentUrl = handleModuleNavigation(module.moduleName);
          return (
            <CustomListItem
              selected={itemSelected === module.moduleName}
              icon={getModuleIcon(module.moduleName)}
              title={module.moduleName}
              onClick={() => handleItemClick(currentUrl, !!module.url)}
              key={index}
            />
          );
        })}
    </>
  );
};

export default Modules;
