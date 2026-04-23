import React from 'react';
import {type ComponentContext} from '../../vendor/a2ui/web_core/index';

export const ChildList: React.FC<{
  childList: unknown;
  context: ComponentContext;
  buildChild: (id: string, basePath?: string) => React.ReactNode;
}> = ({childList, buildChild}) => {
  if (Array.isArray(childList)) {
    return (
      <>
        {childList.map((item: unknown, i: number) => {
          if (item && typeof item === 'object' && 'id' in item) {
            const node = item as {id: string; basePath?: string};
            return (
              <React.Fragment key={`${node.id}-${i}`}>
                {buildChild(node.id, node.basePath)}
              </React.Fragment>
            );
          }
          if (typeof item === 'string') {
            return <React.Fragment key={`${item}-${i}`}>{buildChild(item)}</React.Fragment>;
          }
          return null;
        })}
      </>
    );
  }

  return null;
};
