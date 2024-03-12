function resizeListener(dotnethelper) {
    const xxx = (e) => {
        const size = {
            height: window.innerHeight,
            width: window.innerWidth
        };

        dotnethelper
            .invokeMethodAsync("SetBrowserDimensions", size)
            .then(() => {
                // success, do nothing
            })
            .catch((error) => {
                // handle error
            });
    }
    window.addEventListener("resize", xxx);
    xxx();
}