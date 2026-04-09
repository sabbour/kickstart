import React, {useState} from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {ModalApi} from '../../vendor/a2ui/web_core/basic_catalog/index';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogTrigger,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  trigger: {
    display: 'inline-block',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: tokens.spacingVerticalM,
  },
});

export const Modal = createReactComponent(ModalApi, ({props, buildChild}) => {
  const [isOpen, setIsOpen] = useState(false);
  const classes = useStyles();

  return (
    <Dialog open={isOpen} onOpenChange={(_e, data) => setIsOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <div className={classes.trigger}>
          {props.trigger ? buildChild(props.trigger) : null}
        </div>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogContent>
            {props.content ? buildChild(props.content) : null}
          </DialogContent>
          <div className={classes.actions}>
            <Button appearance="secondary" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
