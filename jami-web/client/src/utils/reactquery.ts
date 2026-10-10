/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { QueryKey, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

// Test whether two elements are equals or not
// Return 'true' if they are equal, 'false' otherwise
export type CheckElementsAreEqual<ElementType> = (element1: ElementType, element2: ElementType) => boolean

type AddToCacheFn<ElementType> = (element: ElementType) => void

export const useAddToCache = <ElementType>(
  queryKey: QueryKey,
  CheckElementsAreEqual: CheckElementsAreEqual<ElementType>,
): AddToCacheFn<ElementType> => {
  const queryClient = useQueryClient()
  return useCallback(
    (newElement: ElementType) => {
      // Make sure the element is not already in the cache
      // This is expected to happen all the time on strict mode
      const data = queryClient.getQueryData<ElementType[]>(queryKey)
      if (data?.find((element) => CheckElementsAreEqual(element, newElement))) {
        return
      }

      // Add the element
      queryClient.setQueryData<ElementType[]>(queryKey, (elements) => [...(elements || []), newElement])
    },
    [CheckElementsAreEqual, queryClient, queryKey],
  )
}

// Check whether the passed element is the one we are looking for or not
type CheckIsElementFn<ElementType, IdentifierType> = (element: ElementType, identifier: IdentifierType) => boolean

type RemoveFromCacheFn<IdentifierType> = (element: IdentifierType) => void

export const useRemoveFromCache = <ElementType, IdentifierType>(
  queryKey: QueryKey,
  checkIsElementFn: CheckIsElementFn<ElementType, IdentifierType>,
): RemoveFromCacheFn<IdentifierType> => {
  const queryClient = useQueryClient()
  return useCallback(
    (identifier: IdentifierType) => {
      queryClient.setQueryData<ElementType[]>(queryKey, (elements) =>
        elements?.filter((element) => !checkIsElementFn(element, identifier)),
      )
    },
    [checkIsElementFn, queryClient, queryKey],
  )
}
