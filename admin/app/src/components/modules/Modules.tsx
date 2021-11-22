import React from 'react';
import { Home } from '@material-ui/icons';
import { getModuleIcon, handleModuleNavigation } from './moduleUtils';
import { useAppDispatch } from '../../redux/store';
import { enqueueInfoNotification } from '../../utils/useNotifier';
import CustomListItem from '../navigation/CustomListItem';
import Link from 'next/link';

interface IModule {
  moduleName: string;
  url: string;
}

interface Props {
  modules: IModule[];
  itemSelected?: string;
  homeEnabled?: boolean;
  disabled?: boolean;
}

const Modules: React.FC<Props> = ({ modules, homeEnabled, itemSelected, disabled }) => {
  const dispatch = useAppDispatch();

  const handleDisabledClick = () => {
    dispatch(enqueueInfoNotification('Module currently disabled.'));
  };

  return (
    <>
      {homeEnabled ? (
        <Link href="/" passHref>
          <CustomListItem
            selected={itemSelected === ''}
            icon={<Home color={'inherit'} />}
            title="home"
          />
        </Link>
      ) : (
        <></>
      )}
      {modules &&
        modules.map((module, index) => {
          if (disabled) {
            return (
              <CustomListItem
                selected={itemSelected === module.moduleName}
                icon={getModuleIcon(module.moduleName)}
                title={module.moduleName}
                onClick={() => handleDisabledClick()}
                key={index}
              />
            );
          }
          const currentUrl = handleModuleNavigation(module.moduleName);
          return (
            <Link href={currentUrl} passHref key={index}>
              <CustomListItem
                selected={itemSelected === module.moduleName}
                icon={getModuleIcon(module.moduleName)}
                title={module.moduleName}
              />
            </Link>
          );
        })}
    </>
  );
};

export default Modules;
