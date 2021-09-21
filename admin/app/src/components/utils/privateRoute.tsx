import React from 'react';

export const privateRoute = (Component: any) => {
  const Auth = (props: any) => {
    // const { token } = useAppSelector((state) => state.appAuthSlice.data.token);
    // const isLoggedIn = !!token;
    //
    // useEffect(() => {
    //   if (!isLoggedIn) {
    //     Router.replace('/login');
    //   }
    // }, [isLoggedIn]);

    return <Component {...props} />;
  };

  if (Component.getInitialProps) {
    Auth.getInitialProps = Component.getInitialProps;
  }

  return Auth;
};

// export function privateRoute(WrappedComponent) {
//   return class ClassComponent extends Component {
//     static async getInitialProps(ctx) {
//       const token = ctx.store.getState().appAuthSlice.data.token;
//       return {
//         auth: !!token,
//       };
//     }
//
//     componentDidMount() {
//       const { auth } = this.props;
//
//       if (!auth) {
//         Router.replace('/login');
//       }
//     }
//
//     render() {
//       const { auth, ...propsWithoutAuth } = this.props;
//       return <WrappedComponent auth={auth} {...propsWithoutAuth} />;
//     }
//   };
// }
