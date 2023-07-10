import React, { useEffect, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import './spinner.css'

interface LoadingViewProps<ViewProps> {
    loadData:    () => Promise<ViewProps>
    ContentView: React.ComponentType<ViewProps | undefined>
}

function LoadingView<ViewProps>({ loadData, ContentView }: LoadingViewProps<ViewProps>): React.JSX.Element {
    const [loading, setLoading] = useState(false);
    const [props,   setProps]   = useState<ViewProps | undefined>(undefined);

    useEffect(() => {
        setLoading(true);
        loadData()
            .then(props => {
                setProps(props);
                setLoading(false);
            });
    }, [loadData]); 

    return (
        <div className="LoadingView">
            <div className={loading ? "loading-overlay" : ""}>
                <Bars
                    color="#00BFFF" // Change spinner color
                    height={100} // Change spinner height
                    width={100} // Change spinner width
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