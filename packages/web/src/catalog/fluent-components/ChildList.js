import React from 'react';
import {} from '../../vendor/a2ui/web_core/index';
export const ChildList = ({ childList, buildChild }) => {
    if (Array.isArray(childList)) {
        return (<>
        {childList.map((item, i) => {
                if (item && typeof item === 'object' && 'id' in item) {
                    const node = item;
                    return (<React.Fragment key={`${node.id}-${i}`}>
                {buildChild(node.id, node.basePath)}
              </React.Fragment>);
                }
                if (typeof item === 'string') {
                    return <React.Fragment key={`${item}-${i}`}>{buildChild(item)}</React.Fragment>;
                }
                return null;
            })}
      </>);
    }
    return null;
};
//# sourceMappingURL=ChildList.js.map