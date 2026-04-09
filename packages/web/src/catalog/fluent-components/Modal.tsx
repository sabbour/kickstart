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
} from '@fluentui/react-components';

export const Modal = createReactComponent(ModalApi, ({props, buildChild}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(_e, data) => setIsOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <div style={{display: 'inline-block'}}>
          {props.trigger ? buildChild(props.trigger) : null}
        </div>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogContent>
            {props.content ? buildChild(props.content) : null}
          </DialogContent>
          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
            <Button appearance="secondary" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
