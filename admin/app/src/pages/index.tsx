import Head from 'next/head';
import React from 'react';
import { Layout } from '../components/navigation/Layout';
import { privateRoute } from '../components/utils/privateRoute';
import Typography from '@material-ui/core/Typography';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';

const Home = () => {
  return (
    <>
      <Head>
        <title>Conduit - App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout itemSelected={0}>
        <Box p={2} display={'flex'} alignItems={'center'} flex={1}>
          <Typography
            variant={'h1'}
            style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
            Welcome to C
            <Slide timeout={2000} in direction={'up'}>
              <Typography
                variant={'h1'}
                component={'span'}
                role="img"
                aria-label="okhand">
                👌
              </Typography>
            </Slide>
            nduit!
          </Typography>
        </Box>
      </Layout>
    </>
  );
};

export default privateRoute(Home);

// import React, { useState } from 'react';
// import { useAppDispatch, useAppSelector } from '../redux/hooks';
// import {
//   selectCount,
//   incrementByAmount,
//   decrement,
//   increment,
// } from '../redux/slices/appAuthSlice';
//
// const IndexPage: React.FC = () => {
//   const dispatch = useAppDispatch();
//   const count = useAppSelector(selectCount);
//   const [incrementAmount, setIncrementAmount] = useState<number>(0);
//
//   return (
//     <>
//       <h1>Welcome to the greatest app in the world!</h1>
//       <h2>
//         The current number is
//         {count}
//       </h2>
//       <div>
//         <input
//           value={incrementAmount}
//           onChange={(e) => setIncrementAmount(Number(e.target.value))}
//           type="number"
//         />
//         <button onClick={() => dispatch(incrementByAmount(Number(incrementAmount)))}>
//           Increment by amount
//         </button>
//       </div>
//       <div>
//         <button onClick={() => dispatch(decrement())}>Decrement by 1</button>
//         <button onClick={() => dispatch(increment())}>Increment by 1</button>
//       </div>
//     </>
//   );
// };
//
// export default IndexPage;
