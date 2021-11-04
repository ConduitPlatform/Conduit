import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import DataTable from '../../components/common/DataTable';
import { EmailUI } from '../../models/emails/EmailModels';
import {
  Button,
  Grid,
  Typography,
  TextField,
  IconButton,
  makeStyles,
  InputAdornment,
  Tooltip,
  Box,
} from '@material-ui/core';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import SearchIcon from '@material-ui/icons/Search';
import Paginator from '../../components/common/Paginator';
import { DeleteTwoTone } from '@material-ui/icons';
import useDebounce from '../../hooks/useDebounce';
import PaymentsLayout from '../../components/navigation/InnerLayouts/paymentsLayout';
import {
  asyncCreateProduct,
  asyncDeleteProducts,
  asyncGetProducts,
  asyncSaveProductChanges,
} from '../../redux/slices/paymentsSlice';
import { Product, reccuringEnum } from '../../models/payments/PaymentsModels';
import ViewEditProduct from '../../components/payments/ViewEditProduct';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

const useStyles = makeStyles((theme) => ({
  btnAlignment: {
    marginLeft: theme.spacing(1.5),
  },
  btnAlignment2: {
    marginRight: theme.spacing(1.5),
  },
  actions: {
    marginBottom: '5px',
  },
  noProducts: {
    textAlign: 'center',
    marginTop: '200px',
  },
}));

const Products = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const originalProductState = {
    _id: '',
    name: '',
    value: 0,
    currency: '',
    isSubscription: false,
    recurring: reccuringEnum.day,
    recurringCount: 0,
    stripe: {
      subscriptionId: '',
      priceId: '',
    },
    updatedAt: '',
    createdAt: '',
  };
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });

  const [openDeleteProducts, setOpenDeleteProducts] = useState<boolean>(false);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product>(originalProductState);
  const [create, setCreate] = useState<boolean>(false);
  const [edit, setEdit] = useState<boolean>(false);

  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    dispatch(asyncGetProducts({ skip, limit, search: debouncedSearch }));
  }, [dispatch, limit, skip, debouncedSearch]);

  const { products, count } = useAppSelector((state) => state.paymentsSlice.data.productData);

  const newProduct = () => {
    setSelectedProduct(originalProductState);
    setCreate(true);
    setEdit(true);
    setDrawer(true);
  };

  const saveProductChanges = (data: Product) => {
    const _id = data._id;
    const updatedData = {
      name: data.name,
      value: data.value,
      currency: data.currency,
      isSubscription: data.isSubscription,
      recurring: data.recurring,
      recurringCount: data.recurringCount,
    };
    if (_id !== undefined) {
      dispatch(asyncSaveProductChanges({ _id, data: updatedData }));
    }
    setSelectedProduct(updatedData);
  };

  const createNewProduct = (data: Product) => {
    const newData = {
      _id: data._id,
      name: data.name,
      value: data.value,
      currency: data.currency,
      isSubscription: data.isSubscription,
      recurring: data.recurring,
      recurringCount: data.recurringCount,
    };
    dispatch(asyncCreateProduct(newData));
    setSelectedProduct(newData);
    setDrawer(false);
  };

  const handleClose = () => {
    setEdit(false);
    setCreate(false);
    setDrawer(false);
    setSelectedProduct(originalProductState);
    setSelectedProduct(originalProductState);
    setOpenDeleteProducts(false);
  };

  const getProductsCallback = useCallback(() => {
    dispatch(asyncGetProducts({ skip, limit, search }));
  }, [dispatch, limit, skip, search]);

  const handleDeleteTitle = (product: Product) => {
    if (selectedProduct.name === '') {
      return 'Delete selected products';
    }
    return `Delete template ${product.name}`;
  };

  const handleDeleteDescription = (product: Product) => {
    if (selectedProduct.name === '') {
      return 'Are you sure you want to delete the selected products?';
    }
    return `Are you sure you want to delete ${product.name}? `;
  };
  const deleteButtonAction = () => {
    if (openDeleteProducts && selectedProduct.name == '') {
      const params = {
        ids: selectedProducts,
        getProducts: getProductsCallback,
      };
      dispatch(asyncDeleteProducts(params));
    } else {
      const params = {
        ids: [`${selectedProduct._id}`],
        getProducts: getProductsCallback,
      };
      dispatch(asyncDeleteProducts(params));
    }
    setOpenDeleteProducts(false);
    setSelectedProduct(originalProductState);
    setSelectedProducts([]);
  };

  const handleSelect = (id: string) => {
    const newSelectedProducts = [...selectedProducts];

    if (selectedProducts.includes(id)) {
      const index = newSelectedProducts.findIndex((newId) => newId === id);
      newSelectedProducts.splice(index, 1);
    } else {
      newSelectedProducts.push(id);
    }
    setSelectedProducts(newSelectedProducts);
  };

  const handleSelectAll = (data: EmailUI[]) => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
      return;
    }
    const newSelectedProducts = data.map((item: EmailUI) => item._id);
    setSelectedProducts(newSelectedProducts);
  };

  const handlePageChange = (event: React.MouseEvent<HTMLButtonElement> | null, val: number) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setSkip(0);
    setPage(0);
  };

  const handleAction = (action: { title: string; type: string }, data: EmailUI) => {
    const currentProduct = products?.find((product) => product._id === data._id);

    if (currentProduct !== undefined) {
      if (action.type === 'view') {
        setSelectedProduct(currentProduct);
        setEdit(false);
        setDrawer(true);
      }
      if (action.type === 'delete') {
        setSelectedProduct(currentProduct);
        setOpenDeleteProducts(true);
      }
    }
  };

  const toDelete = {
    title: 'Delete',
    type: 'delete',
  };

  const toView = {
    title: 'View',
    type: 'view',
  };

  const actions = [toDelete, toView];

  const formatData = (data: Product[]) => {
    return data.map((u) => {
      return {
        _id: u._id,
        value: u.value,
        name: u.name,
        subsciption: u.isSubscription ? 'true' : 'false',
        'Updated At': u.updatedAt,
      };
    });
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Value', sort: 'value' },
    { title: 'Product name', sort: 'name' },
    { title: 'Subscription', sort: 'isSubscription' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

  return (
    <div>
      <Grid container item xs={12} justify="space-between" className={classes.actions}>
        <Grid item>
          {count >= 0 && (
            <TextField
              size="small"
              variant="outlined"
              name="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              label="Find product"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Grid>
        <Grid item>
          {selectedProducts.length > 0 && (
            <IconButton
              style={{ marginRight: '10px' }}
              size="small"
              aria-label="delete"
              color="primary"
              onClick={() => setOpenDeleteProducts(true)}>
              <Tooltip title="Delete multiple products">
                <DeleteTwoTone />
              </Tooltip>
            </IconButton>
          )}
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutline />}
            onClick={() => newProduct()}>
            Add products
          </Button>
        </Grid>
      </Grid>
      {products.length > 0 ? (
        <>
          <DataTable
            sort={sort}
            setSort={setSort}
            headers={headers}
            dsData={formatData(products)}
            actions={actions}
            handleAction={handleAction}
            handleSelect={handleSelect}
            handleSelectAll={handleSelectAll}
            selectedItems={selectedProducts}
          />
          <Grid container style={{ marginTop: '-8px' }}>
            <Grid item xs={7} />
            <Grid item xs={5}>
              <Paginator
                handlePageChange={handlePageChange}
                limit={limit}
                handleLimitChange={handleLimitChange}
                page={page}
                count={count}
              />
            </Grid>
          </Grid>
        </>
      ) : (
        <Box className={classes.noProducts}>
          <Typography>No available products</Typography>
        </Box>
      )}
      <DrawerWrapper open={drawer} closeDrawer={() => handleClose()} width={750}>
        <Box>
          <Typography variant="h6" style={{ marginTop: '30px', textAlign: 'center' }}>
            {!create ? 'Product overview' : 'Create a new product'}
          </Typography>
          <ViewEditProduct
            handleCreate={createNewProduct}
            handleSave={saveProductChanges}
            product={selectedProduct}
            edit={edit}
            setEdit={setEdit}
            create={create}
            setCreate={setCreate}
            handleClose={() => handleClose()}
          />
        </Box>
      </DrawerWrapper>
      <ConfirmationDialog
        open={openDeleteProducts}
        handleClose={handleClose}
        title={handleDeleteTitle(selectedProduct)}
        description={handleDeleteDescription(selectedProduct)}
        buttonAction={deleteButtonAction}
        buttonText={'Delete'}
      />
    </div>
  );
};

Products.getLayout = function getLayout(page: ReactElement) {
  return <PaymentsLayout>{page}</PaymentsLayout>;
};

export default Products;
