import React, { useEffect, useState, useRef } from 'react';
import { Bars } from 'react-loader-spinner';
import './loadingView.css'

import { EventEmitter } from 'eventemitter3';
import uuid from '../../utils/uuid';

export class LoadingEventEmitter {

    private readonly uuid         = uuid(32)
    private readonly eventEmitter = new EventEmitter()

    private get reloadEventId(): string { return `reloadData-${this.uuid}` }

    public reload(): void {
        this.eventEmitter.emit(this.reloadEventId)
    }

    public onReload(fn: (...args: any[]) => void, context?: any): EventEmitter<string | symbol, any> {
        return this.eventEmitter.on(this.reloadEventId, fn, context)
    }

    public offReload(fn?: (...args: any[]) => void, context?: any, once?: boolean): EventEmitter<string | symbol, any> {
        return this.eventEmitter.off(this.reloadEventId, fn, context, once)
    }
}

interface LoadingViewProps<ViewProps> {
    loadData:             () => Promise<ViewProps>
    ContentView:          React.ComponentType<ViewProps>
    loadingEventEmitter?: LoadingEventEmitter
}

function LoadingView<ViewProps>({ loadData, ContentView, loadingEventEmitter }: LoadingViewProps<ViewProps>): React.JSX.Element {
    // loading data
    const [loading, setLoading] = useState(false);
    const [props,   setProps]   = useState<ViewProps | undefined>(undefined);
    const [counter, setCounter] = useState(0);

    useEffect(() => {
        if (loadingEventEmitter) {
            const updateData = () => { setCounter(counter => counter + 1) }
            loadingEventEmitter.onReload(updateData)
            return () => { loadingEventEmitter.offReload(updateData) }
        }
    }, [loadingEventEmitter]);

    useEffect(() => {
        const startCounter = counter

        let startedLoadingAnmation = false
        const loadingTimeout = setTimeout(() => {
            setLoading(true)
            startedLoadingAnmation = true
        }, 200)

        loadData()
            .then(props => {
                setProps(props);
                if (startedLoadingAnmation && startCounter === counter) {
                    setLoading(false)
                } else {
                    clearTimeout(loadingTimeout)
                }
            });
    }, [loadData, counter]);


    // sizing spinner
    const containerRef = useRef<HTMLDivElement>(null);
    const [spinnerSize, setSpinnerSize] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            setSpinnerSize(containerRef.current.offsetHeight);
        }
    }, [loading]);

    return (
        <div className="LoadingView">
            <div ref={containerRef} className={loading ? "loading-overlay" : ""}>
                <Bars
                    wrapperClass="loading-animation"
                    color="#797979" // Change spinner color
                    height={spinnerSize >= 3 ? spinnerSize - 3 : spinnerSize} // Change spinner height
                    width={spinnerSize >= 3 ? spinnerSize - 3 : spinnerSize} // Change spinner width
                    visible={loading}
                />
            </div>
            <div className="content">
                <ContentView {...props} />
            </div>
        </div>
      );
}

export default LoadingView