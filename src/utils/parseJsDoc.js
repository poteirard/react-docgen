/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { parse as typeParse } from 'jsdoctypeparser';
import commentParse from 'comment-parser';

type JsDoc = {
  description: ?string,
  params: Array<{
    name: string,
    description: ?string,
    type: ?{ name: string },
    optional?: boolean,
  }>,
  returns: ?{
    description: ?string,
    type: ?{ name: string },
  },
};

function getType(tagType) {
  if (!tagType) {
    return null;
  }

  const { type, name, left, right, entries, subject, objects } = tagType?.type
    ? tagType
    : typeParse(tagType);

  // Types: https://github.com/jsdoctypeparser/jsdoctypeparser#ast-specifications
  switch (type) {
    case 'NAME':
      // {a}
      return { name };
    case 'UNION':
      // {a|b}
      // eslint-disable-next-line no-case-declarations
      const parsedElements = [left, right].map(getType);
      return {
        name: 'union',
        elements: parsedElements,
      };
    case 'OPTIONAL':
      // {string=}
      return { name: tagType.replace(/=$/, '') };
    case 'ANY':
      // {*}
      return { name: 'mixed' };
    case 'GENERIC':
      // {Array<string>} or {string[]}
      return {
        name: subject.name,
        elements: objects.map(getType),
      };
    case 'TUPLE':
      // {[number, string]}
      return {
        name: 'tuple',
        elements: entries.map(getType),
      };
    default: {
      return null;
    }
  }
}

function getOptional(tag): boolean {
  return !!(
    tag.type &&
    (tag.optional || typeParse(tag.type).type === 'OPTIONAL')
  );
}

// Add jsdoc @return description.
function getReturnsJsDoc(jsDoc) {
  const returnTag = jsDoc.tags.find(
    tag => tag.tag === 'returns' || tag.tag === 'return',
  );
  if (returnTag) {
    const { type, description: returnTagDescription, source, tag } = returnTag;
    const description = type
      ? returnTagDescription || null
      : source.replace(`@${tag} `, '') || null;
    return {
      description,
      type: getType(returnTag.type),
    };
  }
  return null;
}

// Add jsdoc @param descriptions.
function getParamsJsDoc(jsDoc) {
  if (!jsDoc.tags) {
    return [];
  }
  return jsDoc.tags
    .filter(tag => tag.tag === 'param')
    .map(tag => ({
      name: tag.name,
      description: tag.description || null,
      type: getType(tag.type),
      optional: getOptional(tag),
    }));
}

export default function parseJsDoc(docblock: string): JsDoc {
  const jsDoc = commentParse(`/** ${docblock} */`);
  const firstDoc = jsDoc.length ? jsDoc[0] : undefined;

  return {
    description: firstDoc?.description || null,
    params: getParamsJsDoc(firstDoc),
    returns: getReturnsJsDoc(firstDoc),
  };
}
