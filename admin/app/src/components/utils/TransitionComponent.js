import Collapse from '@material-ui/core/Collapse';
import PropTypes from 'prop-types';
import React from 'react';
import { animated, useSpring } from 'react-spring/web.cjs';

const TransitionComponent = (props) => {
  const style = useSpring({
    from: { opacity: 0, transform: 'translate3d(20px,0,0)' },
    to: {
      opacity: props.in ? 1 : 0,
      transform: `translate3d(${props.in ? 0 : 20}px,0,0)`,
    },
  });

  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
};

TransitionComponent.propTypes = {
  /**
   * Show the component; triggers the enter or exit states
   */
  in: PropTypes.bool,
};

export default TransitionComponent;
