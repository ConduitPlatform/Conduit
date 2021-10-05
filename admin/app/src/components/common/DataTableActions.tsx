import React from 'react';
import { Box, IconButton, Tooltip } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import BlockIcon from '@material-ui/icons/Block';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

interface Action {
  title: string;
  type: string;
}

interface Props {
  actions?: Action[];
  onActionClick: (action: Action) => void;
  isBlocked: boolean;
  editDisabled?: boolean;
}

const DataTableActions: React.FC<Props> = ({ actions, onActionClick, isBlocked, editDisabled }) => {
  const handleActions = (action: Action) => {
    switch (action.type) {
      case 'delete':
        return <DeleteIcon color="primary" />;
      case 'edit':
        return <EditIcon color={editDisabled ? 'disabled' : 'primary'} />;
      case 'block/unblock':
        return <BlockIcon color={isBlocked ? 'error' : 'primary'} />;
      case 'disable':
        return <BlockIcon color="primary" />;
      case 'enable':
        return <CheckCircleIcon color="primary" />;
      default:
        return <></>;
    }
  };

  return (
    <Box display="flex" justifyContent="flex-end">
      {actions &&
        actions.map((action, index) => {
          return (
            <Tooltip title={action.title} key={index}>
              <IconButton
                key={`${action.title}${index}`}
                onClick={() => onActionClick(action)}
                disabled={action.type === 'edit' && editDisabled}>
                {handleActions(action)}
              </IconButton>
            </Tooltip>
          );
        })}
    </Box>
  );
};

export default DataTableActions;
