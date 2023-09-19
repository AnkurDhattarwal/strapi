import * as React from 'react';

import * as Toolbar from '@radix-ui/react-toolbar';
import {
  Icon,
  Tooltip,
  Select,
  Option,
  Popover,
  Field,
  FieldLabel,
  FieldInput,
  Flex,
  Button,
} from '@strapi/design-system';
import { pxToRem } from '@strapi/helper-plugin';
import { BulletList, NumberList, Link } from '@strapi/icons';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';
import { Editor, Transforms, Element as SlateElement } from 'slate';
import { ReactEditor, useSlate } from 'slate-react';
import styled from 'styled-components';

import { useBlocksStore } from '../hooks/useBlocksStore';
import { useModifiersStore } from '../hooks/useModifiersStore';
import { insertLink } from '../utils/links';

const Separator = styled(Toolbar.Separator)`
  background: ${({ theme }) => theme.colors.neutral150};
  width: 1px;
  height: ${pxToRem(24)};
`;

const FlexButton = styled(Flex).attrs({ as: 'button' })`
  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
  }
`;

const ToolbarButton = React.forwardRef(({ icon, name, label, isActive, handleClick }, ref) => {
  const { formatMessage } = useIntl();
  const labelMessage = formatMessage(label);

  return (
    <Tooltip description={labelMessage}>
      <Toolbar.ToggleItem value={name} data-state={isActive ? 'on' : 'off'} asChild>
        <FlexButton
          ref={ref}
          background={isActive ? 'primary100' : ''}
          alignItems="center"
          justifyContent="center"
          width={7}
          height={7}
          hasRadius
          onMouseDown={(e) => {
            e.preventDefault();
            handleClick();
          }}
          aria-label={labelMessage}
        >
          <Icon width={3} height={3} as={icon} color={isActive ? 'primary600' : 'neutral600'} />
        </FlexButton>
      </Toolbar.ToggleItem>
    </Tooltip>
  );
});

ToolbarButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.shape({
    id: PropTypes.string.isRequired,
    defaultMessage: PropTypes.string.isRequired,
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  handleClick: PropTypes.func.isRequired,
};

const ModifierButton = ({ icon, name, label }) => {
  const editor = useSlate();

  const isModifierActive = () => {
    const modifiers = Editor.marks(editor);

    if (!modifiers) return false;

    return Boolean(modifiers[name]);
  };

  const isActive = isModifierActive();

  const toggleModifier = () => {
    if (isActive) {
      Editor.removeMark(editor, name);
    } else {
      Editor.addMark(editor, name, true);
    }
  };

  return (
    <ToolbarButton
      icon={icon}
      name={name}
      label={label}
      isActive={isActive}
      handleClick={toggleModifier}
    />
  );
};

ModifierButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.shape({
    id: PropTypes.string.isRequired,
    defaultMessage: PropTypes.string.isRequired,
  }).isRequired,
};

const isBlockActive = (editor, matchNode) => {
  const { selection } = editor;

  if (!selection) return false;

  const match = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && matchNode(n),
    })
  );

  return match.length > 0;
};

const toggleBlock = (editor, value) => {
  const { type, level } = value;

  const newProperties = {
    type,
    level: level || null,
  };

  Transforms.setNodes(editor, newProperties);
};

const BlocksDropdown = () => {
  const editor = useSlate();
  const { formatMessage } = useIntl();

  const blocks = useBlocksStore();
  const blockKeysToInclude = Object.entries(blocks).reduce((currentKeys, entry) => {
    const [key, block] = entry;

    return block.isInBlocksSelector ? [...currentKeys, key] : currentKeys;
  }, []);

  const [blockSelected, setBlockSelected] = React.useState(Object.keys(blocks)[0]);

  /**
   * @param {string} optionKey - key of the heading selected
   */
  const selectOption = (optionKey) => {
    toggleBlock(editor, blocks[optionKey].value);

    setBlockSelected(optionKey);
  };

  return (
    <Select
      startIcon={<Icon as={blocks[blockSelected].icon} />}
      onChange={selectOption}
      placeholder={blocks[blockSelected].label}
      value={blockSelected}
      aria-label={formatMessage({
        id: 'components.Blocks.blocks.selectBlock',
        defaultMessage: 'Select a block',
      })}
    >
      {blockKeysToInclude.map((key) => (
        <BlockOption
          key={key}
          value={key}
          label={blocks[key].label}
          icon={blocks[key].icon}
          matchNode={blocks[key].matchNode}
          handleSelection={setBlockSelected}
          blockSelected={blockSelected}
        />
      ))}
    </Select>
  );
};

const BlockOption = ({ value, icon, label, handleSelection, blockSelected, matchNode }) => {
  const { formatMessage } = useIntl();
  const editor = useSlate();

  const isActive = isBlockActive(editor, matchNode);
  const isSelected = value === blockSelected;

  React.useEffect(() => {
    if (isActive && !isSelected) {
      handleSelection(value);
    }
  }, [handleSelection, isActive, isSelected, value]);

  return (
    <Option
      startIcon={<Icon as={icon} color={isSelected ? 'primary600' : 'neutral600'} />}
      value={value}
    >
      {formatMessage(label)}
    </Option>
  );
};

BlockOption.propTypes = {
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  label: PropTypes.shape({
    id: PropTypes.string.isRequired,
    defaultMessage: PropTypes.string.isRequired,
  }).isRequired,
  matchNode: PropTypes.func.isRequired,
  handleSelection: PropTypes.func.isRequired,
  blockSelected: PropTypes.string.isRequired,
};

const ListButton = ({ icon, format, label }) => {
  const editor = useSlate();

  /**
   *
   * @param {import('slate').Node} node
   * @returns boolean
   */
  const isListNode = (node) => {
    return !Editor.isEditor(node) && SlateElement.isElement(node) && node.type === 'list';
  };

  const isListActive = () => {
    const { selection } = editor;

    if (!selection) return false;

    const [match] = Array.from(
      Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: (node) => isListNode(node) && node.format === format,
      })
    );

    return Boolean(match);
  };

  const isActive = isListActive();

  const toggleList = () => {
    // Delete the parent list so that we're left with only the list items directly
    Transforms.unwrapNodes(editor, {
      match: (node) => isListNode(node) && ['ordered', 'unordered'].includes(node.format),
      split: true,
    });

    // Change the type of the current selection
    Transforms.setNodes(editor, {
      type: isActive ? 'paragraph' : 'list-item',
    });

    // If the selection is now a list item, wrap it inside a list
    if (!isActive) {
      const block = { type: 'list', format, children: [] };
      Transforms.wrapNodes(editor, block);
    }
  };

  return (
    <ToolbarButton
      icon={icon}
      name={format}
      label={label}
      isActive={isActive}
      handleClick={toggleList}
    />
  );
};

ListButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  format: PropTypes.string.isRequired,
  label: PropTypes.shape({
    id: PropTypes.string.isRequired,
    defaultMessage: PropTypes.string.isRequired,
  }).isRequired,
};

const LinkButton = () => {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const toolbarButtonRef = React.useRef(null);
  const domNodeRef = React.useRef(null);
  const editor = useSlate();
  const { selection } = editor;

  const isLinkActive = () => {
    if (!selection) return false;

    const [match] = Array.from(
      Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: (node) =>
          !Editor.isEditor(node) && SlateElement.isElement(node) && node.type === 'link',
      })
    );

    return Boolean(match);
  };

  const isActive = isLinkActive();

  const saveLink = ({ target }) => {
    const { text, url } = target.elements;

    insertLink(editor, { url: url.value, text: text.value });

    setPopoverOpen(false);
  };

  const toggleLinkPopover = () => {
    // @TODO: Here we are getting the reference for the selected node
    // this is fine for one line and not longer texts
    // but if you select a word in a looong paragraph, we will get the reference of the whole paragraph
    // because we are rendering all the paragraph as a single <span> element
    const selectedNode = Editor.node(editor, selection);
    const domElement = ReactEditor.toDOMNode(editor, selectedNode[0]);
    domNodeRef.current = domElement;

    setPopoverOpen(true);
  };

  console.log({ editor });

  return (
    <>
      <ToolbarButton
        ref={toolbarButtonRef}
        icon={Link}
        name="link"
        label={{
          id: 'components.Blocks.link',
          defaultMessage: 'Link',
        }}
        isActive={isActive}
        handleClick={toggleLinkPopover}
      />
      {popoverOpen && (
        <Popover
          source={domNodeRef}
          onDismiss={() => setPopoverOpen(false)}
          padding={4}
          placement="right-end"
        >
          <Flex as="form" onSubmit={saveLink} direction="column" gap={4}>
            <Field width="300px">
              <FieldLabel>Text</FieldLabel>
              <FieldInput
                name="text"
                placeholder="This text is the text of the link"
                defaultValue={Editor.string(editor, selection)}
              />
            </Field>
            <Field width="300px">
              <FieldLabel>Link</FieldLabel>
              <FieldInput name="url" placeholder="https://strapi.io" />
            </Field>
            <Flex justifyContent="end" width="100%" gap={2}>
              <Button variant="tertiary" onClick={() => setPopoverOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </Flex>
          </Flex>
        </Popover>
      )}
    </>
  );
};

const BlocksToolbar = () => {
  const modifiers = useModifiersStore();

  return (
    <Toolbar.Root asChild>
      <Flex gap={1} padding={2}>
        <BlocksDropdown />
        <Separator />
        <Toolbar.ToggleGroup type="multiple" asChild>
          <Flex gap={1}>
            {Object.entries(modifiers).map(([name, modifier]) => (
              <ToolbarButton
                key={name}
                name={name}
                icon={modifier.icon}
                label={modifier.label}
                isActive={modifier.checkIsActive()}
                handleClick={modifier.handleToggle}
              />
            ))}
            <LinkButton />
          </Flex>
        </Toolbar.ToggleGroup>
        <Separator />
        <Toolbar.ToggleGroup type="single" asChild>
          <Flex gap={1}>
            <ListButton
              label={{
                id: 'components.Blocks.blocks.unorderedList',
                defaultMessage: 'Unordered list',
              }}
              format="unordered"
              icon={BulletList}
            />
            <ListButton
              label={{
                id: 'components.Blocks.blocks.orderedList',
                defaultMessage: 'Ordered list',
              }}
              format="ordered"
              icon={NumberList}
            />
          </Flex>
        </Toolbar.ToggleGroup>
      </Flex>
    </Toolbar.Root>
  );
};

export { BlocksToolbar };