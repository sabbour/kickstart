import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { ModalApi } from '../../vendor/a2ui/web_core/basic_catalog/index';
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger, Button, makeStyles, tokens, } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
const useStyles = makeStyles({
    trigger: {
        display: 'inline-block',
    },
    surface: {
        maxWidth: '600px',
        padding: tokens.spacingHorizontalXXL,
    },
});
export const Modal = createReactComponent(ModalApi, ({ props, buildChild }) => {
    const [isOpen, setIsOpen] = useState(false);
    const classes = useStyles();
    return (<Dialog open={isOpen} onOpenChange={(_e, data) => setIsOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <div className={classes.trigger}>
          {props.trigger ? buildChild(props.trigger) : null}
        </div>
      </DialogTrigger>
      <DialogSurface className={classes.surface}>
        <DialogBody>
          <DialogTitle action={<DialogTrigger action="close">
                <Button appearance="subtle" aria-label="Close" icon={<DismissRegular />}/>
              </DialogTrigger>}/>
          <DialogContent>
            {props.content ? buildChild(props.content) : null}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">Close</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>);
});
//# sourceMappingURL=Modal.js.map