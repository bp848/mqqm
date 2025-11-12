import React, { useState, useEffect } from 'react';
import { ApprovalRoute } from '../../types.ts';
// FIX: Add missing import for getApprovalRoutes.
import { getApprovalRoutes } from '../../services/dataService.ts';

interface ApprovalRouteSelectorProps {
    onChange: (routeId: string) => void;
    isSubmitting: boolean;
    requiredRouteName?: string;
}

const ApprovalRouteSelector: React.FC<ApprovalRouteSelectorProps> = ({ onChange, isSubmitting, requiredRouteName }) => {
    const [routes, setRoutes] = useState<ApprovalRoute[]>([]);
    const [selectedRoute, setSelectedRoute] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<React.ReactNode | string>('');

    useEffect(() => {
        let isMounted = true;
        const fetchRoutes = async () => {
            try {
                const fetchedRoutes = await getApprovalRoutes();
                